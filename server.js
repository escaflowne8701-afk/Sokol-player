const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const axios = require("axios");
const { spawn } = require("child_process");

const app = express();
app.use(express.json({ limit: "400mb" }));
app.use(express.urlencoded({ limit: "400mb", extended: true }));
app.use(express.static("public", {
  setHeaders: (res, path) => {
    if (path.endsWith('.js') || path.endsWith('.css') || path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

const UPLOAD = path.join(__dirname, "upload");
if (!fs.existsSync(UPLOAD)) fs.mkdirSync(UPLOAD, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD),
  filename: (req, file, cb) => cb(null, "playlist.m3u"),
});
const upload = multer({ storage, limits: { fileSize: 1000 * 1024 * 1024 } });

app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "no file" });
  res.json({ ok: true });
});

app.post("/upload-m3u", async (req, res) => {
  try {
    const payload = (req.body.playlist || "").toString().trim();
    if (!payload) return res.status(400).json({ error: "empty" });
    if (/^https?:\/\//i.test(payload)) {
      const r = await axios.get(payload, {
        timeout: 30000,
        responseType: "text",
      });
      fs.writeFileSync(path.join(UPLOAD, "playlist.m3u"), r.data, "utf8");
      return res.json({ ok: true });
    } else {
      fs.writeFileSync(path.join(UPLOAD, "playlist.m3u"), payload, "utf8");
      return res.json({ ok: true });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "save failed" });
  }
});

app.get("/upload/playlist.m3u", (req, res) => {
  const fp = path.join(UPLOAD, "playlist.m3u");
  if (!fs.existsSync(fp)) return res.status(404).send("No playlist");
  res.type("audio/x-mpegurl");
  res.sendFile(fp);
});

function parseM3U(text) {
  const lines = text.split(/\r?\n/);
  const out = [];
  let cur = null;
  let vlcOpts = {};
  const attrRe = /([a-zA-Z0-9\-_]+)="([^"]*)"/g;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#EXTINF")) {
      const name = line.includes(",")
        ? line.split(",").slice(1).join(",").trim()
        : "";
      const attrs = {};
      for (const m of line.matchAll(attrRe)) attrs[m[1]] = m[2];
      cur = {
        title: name,
        tvgName: attrs["tvg-name"] || "",
        tvgLogo: attrs["tvg-logo"] || "",
        group: attrs["group-title"] || "",
        url: "",
        headers: {},
      };
      vlcOpts = {};
    } else if (line.startsWith("#EXTVLCOPT:")) {
      const opt = line.substring(11);
      const eqIdx = opt.indexOf("=");
      if (eqIdx > 0) {
        const key = opt.substring(0, eqIdx).trim();
        const val = opt.substring(eqIdx + 1).trim();
        vlcOpts[key] = val;
      }
    } else if (!line.startsWith("#")) {
      if (cur) {
        cur.url = line;
        cur.headers = vlcOpts;
        out.push(cur);
        cur = null;
        vlcOpts = {};
      } else {
        out.push({
          title: line,
          tvgName: "",
          tvgLogo: "",
          group: "",
          url: line,
          headers: {},
        });
      }
    }
  }
  return out;
}

function splitByCategory(items) {
  const live = [],
    movies = [],
    series = [];
  for (const it of items) {
    const u = (it.url || "").toLowerCase();
    if (
      u.includes("/series/") ||
      /S\d{1,2}\s*E\d{1,2}/i.test(it.tvgName || it.title)
    )
      series.push(it);
    else if (
      u.includes("/movie/") ||
      u.endsWith(".mp4") ||
      /movie|film|cinema/i.test(it.group)
    )
      movies.push(it);
    else live.push(it);
  }
  return { live, movies, series };
}

app.get("/api/categories", (req, res) => {
  const fp = path.join(UPLOAD, "playlist.m3u");
  if (!fs.existsSync(fp)) return res.json({ live: [], movies: [], series: [] });
  const txt = fs.readFileSync(fp, "utf8");
  const parsed = parseM3U(txt);
  const { live, movies, series } = splitByCategory(parsed);
  const unique = (arr) => [...new Set(arr.map((i) => i.group).filter(Boolean))];
  res.json({
    live: unique(live),
    movies: unique(movies),
    series: unique(series),
  });
});

app.get("/api/items/:type/:group", (req, res) => {
  const type = req.params.type;
  const group = req.params.group || "";
  const decodedGroup = decodeURIComponent(group);
  const fp = path.join(UPLOAD, "playlist.m3u");
  if (!fs.existsSync(fp)) return res.json([]);
  const txt = fs.readFileSync(fp, "utf8");
  const parsed = parseM3U(txt);
  const { live, movies, series } = splitByCategory(parsed);
  const map = { live, movies, series };
  const list =
    decodedGroup === "__ALL__"
      ? map[type] || []
      : (map[type] || []).filter((i) => i.group === decodedGroup);
  res.json(list);
});

app.get("/api/series_struct/:group", (req, res) => {
  const decoded = decodeURIComponent(req.params.group || "");
  const fp = path.join(UPLOAD, "playlist.m3u");
  if (!fs.existsSync(fp)) return res.json({});
  const txt = fs.readFileSync(fp, "utf8");
  const parsed = parseM3U(txt);
  const seriesItems =
    decoded === "__ALL__"
      ? parsed.filter(
          (i) =>
            i.url.toLowerCase().includes("/series/") ||
            /S\d{1,2}\s*E\d{1,2}/i.test(i.tvgName || i.title),
        )
      : parsed.filter(
          (i) =>
            i.group === decoded &&
            (i.url.toLowerCase().includes("/series/") ||
              /S\d{1,2}\s*E\d{1,2}/i.test(i.tvgName || i.title)),
        );
  const shows = {};
  for (const it of seriesItems) {
    const name = (it.tvgName || it.title).trim();
    const m =
      name.match(/^(?:\|..\|\s*)?(.*)S(\d{1,2})\s*E(\d{1,2})/i) ||
      name.match(/^(?:\|..\|\s*)?(.*)\b(\d{1,2})x(\d{1,2})/i);
    let showTitle = name;
    let season = 1,
      episode = 1;
    if (m) {
      showTitle = (m[1] || "").replace(/\|..\|/g, "").trim();
      season = parseInt(m[2], 10) || 1;
      episode = parseInt(m[3], 10) || 1;
    } else {
      showTitle = name.replace(/^\|..\|\s*/, "").trim();
    }
    if (!shows[showTitle])
      shows[showTitle] = {
        title: showTitle,
        poster: it.tvgLogo || "",
        seasons: {},
      };
    if (!shows[showTitle].seasons[season])
      shows[showTitle].seasons[season] = [];
    shows[showTitle].seasons[season].push({
      episode,
      name,
      url: it.url,
      logo: it.tvgLogo || "",
    });
  }
  for (const s of Object.keys(shows)) {
    for (const ss of Object.keys(shows[s].seasons)) {
      shows[s].seasons[ss].sort((a, b) => a.episode - b.episode);
    }
  }
  res.json(shows);
});

// Simple EPG endpoint (basic)
app.get("/api/epg", (req, res) => {
  const epgPath = path.join(UPLOAD, "epg.xml");
  if (!fs.existsSync(epgPath)) {
    return res.json({});
  }

  try {
    // Just return empty for now - client will handle parsing
    res.json({});
  } catch (error) {
    console.error("EPG error:", error);
    res.json({});
  }
});

app.post("/upload-epg", async (req, res) => {
  try {
    const { epgUrl, epgContent } = req.body;

    if (epgUrl && /^https?:\/\//i.test(epgUrl)) {
      const response = await axios.get(epgUrl, {
        timeout: 30000,
        responseType: "text",
      });
      fs.writeFileSync(path.join(UPLOAD, "epg.xml"), response.data, "utf8");
      return res.json({ ok: true, source: "url" });
    } else if (epgContent) {
      fs.writeFileSync(path.join(UPLOAD, "epg.xml"), epgContent, "utf8");
      return res.json({ ok: true, source: "content" });
    } else {
      return res.status(400).json({ error: "No EPG data provided" });
    }
  } catch (error) {
    console.error("EPG upload error:", error);
    res.status(500).json({ error: "Failed to save EPG" });
  }
});

// Stream Proxy - mimics VLC player behavior
app.get("/stream", async (req, res) => {
  try {
    const target = req.query.url;
    if (!target) return res.status(400).send("Missing URL");

    // Build headers like VLC player does
    const headers = {
      "User-Agent": "VLC/3.0.18 LibVLC/3.0.18",
      Accept: "*/*",
      "Accept-Language": "en-US,en;q=0.9",
      Connection: "keep-alive",
      "Icy-MetaData": "1",
    };

    // Parse custom headers from query string
    if (req.query.ua) headers["User-Agent"] = req.query.ua;
    if (req.query.referer) headers["Referer"] = req.query.referer;
    if (req.query.origin) headers["Origin"] = req.query.origin;

    const response = await axios({
      method: "GET",
      url: target,
      responseType: "stream",
      timeout: 60000,
      maxRedirects: 10,
      validateStatus: () => true,
      headers: headers,
      decompress: true,
    });

    // Forward content type
    const contentType = response.headers["content-type"];
    if (contentType) {
      res.setHeader("Content-Type", contentType);
    } else {
      // Default to MPEG transport stream for IPTV
      res.setHeader("Content-Type", "video/mp2t");
    }

    if (response.headers["content-range"])
      res.setHeader("Content-Range", response.headers["content-range"]);
    if (response.headers["content-length"])
      res.setHeader("Content-Length", response.headers["content-length"]);

    res.setHeader("Content-Disposition", "inline");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Cache-Control", "no-cache, no-store");

    response.data.on("error", (err) => {
      console.error("STREAM PIPE ERROR:", err && err.message);
      try {
        res.end();
      } catch (e) {}
    });

    req.on("close", () => {
      try {
        response.data.destroy();
      } catch (e) {}
    });

    response.data.pipe(res);
  } catch (err) {
    console.error("STREAM ERROR:", err && (err.message || err.toString()));
    res.status(500).send("Stream error");
  }
});

// FFmpeg transcoding endpoint for Xtream Codes and other IPTV streams
app.get("/transcode", (req, res) => {
  const target = req.query.url;
  if (!target) return res.status(400).send("Missing URL");

  console.log("FFmpeg transcoding:", target);

  res.setHeader("Content-Type", "video/mp4");
  res.setHeader("Transfer-Encoding", "chunked");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-cache, no-store");

  const ffmpegArgs = [
    "-reconnect",
    "1",
    "-reconnect_streamed",
    "1",
    "-reconnect_delay_max",
    "5",
    "-headers",
    "User-Agent: VLC/3.0.18 LibVLC/3.0.18\r\nAccept: */*\r\nConnection: keep-alive\r\n",
    "-i",
    target,
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-tune",
    "zerolatency",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-f",
    "mp4",
    "-movflags",
    "frag_keyframe+empty_moov+faststart",
    "-",
  ];

  console.log("FFmpeg args:", ffmpegArgs.join(" "));

  const ffmpeg = spawn("ffmpeg", ffmpegArgs);

  ffmpeg.stdout.pipe(res);

  ffmpeg.stderr.on("data", (data) => {
    console.log("FFmpeg:", data.toString().slice(0, 200));
  });

  ffmpeg.on("error", (err) => {
    console.error("FFmpeg spawn error:", err.message);
    if (!res.headersSent) res.status(500).send("FFmpeg error");
  });

  ffmpeg.on("close", (code) => {
    console.log("FFmpeg closed with code:", code);
  });

  req.on("close", () => {
    ffmpeg.kill("SIGTERM");
  });
});

// Direct passthrough endpoint - FFmpeg just copies the stream without re-encoding
app.get("/passthrough", (req, res) => {
  const target = req.query.url;
  if (!target) return res.status(400).send("Missing URL");

  console.log("FFmpeg passthrough:", target);

  res.setHeader("Content-Type", "video/mp2t");
  res.setHeader("Transfer-Encoding", "chunked");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-cache, no-store");

  const ffmpeg = spawn("ffmpeg", [
    "-reconnect",
    "1",
    "-reconnect_streamed",
    "1",
    "-reconnect_delay_max",
    "5",
    "-headers",
    "User-Agent: VLC/3.0.18 LibVLC/3.0.18\r\nAccept: */*\r\nConnection: keep-alive\r\n",
    "-i",
    target,
    "-c",
    "copy",
    "-f",
    "mpegts",
    "-",
  ]);

  ffmpeg.stdout.pipe(res);

  ffmpeg.stderr.on("data", (data) => {
    console.log("FFmpeg passthrough:", data.toString().slice(0, 200));
  });

  ffmpeg.on("error", (err) => {
    console.error("FFmpeg passthrough error:", err.message);
    if (!res.headersSent) res.status(500).send("FFmpeg error");
  });

  ffmpeg.on("close", (code) => {
    console.log("FFmpeg passthrough closed with code:", code);
  });

  req.on("close", () => {
    ffmpeg.kill("SIGTERM");
  });
});

// WebM transcoding - better browser support
app.get("/webm-transcode", (req, res) => {
  const target = req.query.url;
  if (!target) return res.status(400).send("Missing URL");

  console.log("WebM transcoding:", target);

  res.setHeader("Content-Type", "video/webm");
  res.setHeader("Transfer-Encoding", "chunked");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-cache, no-store");

  const ffmpeg = spawn("ffmpeg", [
    "-reconnect",
    "1",
    "-reconnect_streamed",
    "1",
    "-reconnect_delay_max",
    "5",
    "-headers",
    "User-Agent: VLC/3.0.18 LibVLC/3.0.18\r\nAccept: */*\r\nConnection: keep-alive\r\n",
    "-i",
    target,
    "-c:v",
    "libvpx",
    "-b:v",
    "1M",
    "-c:a",
    "libvorbis",
    "-f",
    "webm",
    "-",
  ]);

  ffmpeg.stdout.pipe(res);

  ffmpeg.stderr.on("data", (data) => {
    console.log("FFmpeg WebM:", data.toString().slice(0, 200));
  });

  ffmpeg.on("error", (err) => {
    console.error("FFmpeg WebM error:", err.message);
    if (!res.headersSent) res.status(500).send("FFmpeg error");
  });

  ffmpeg.on("close", (code) => {
    console.log("FFmpeg WebM closed with code:", code);
  });

  req.on("close", () => {
    ffmpeg.kill("SIGTERM");
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log("Sokol Player running on", PORT));
