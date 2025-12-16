
import Hls from "https://cdn.jsdelivr.net/npm/hls.js@latest";

export function playStream(video, url, isLive = false) {
  if (isLive && Hls.isSupported()) {
    const hls = new Hls({ lowLatencyMode: true });
    hls.loadSource(url);
    hls.attachMedia(video);
  } else {
    video.src = url;
    video.play();
  }
}
