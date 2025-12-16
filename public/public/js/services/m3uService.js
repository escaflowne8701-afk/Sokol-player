// public/js/services/m3uService.js - Client-side M3U parsing
export function parseM3U(text) {
  const lines = text.split("\n");
  const items = [];
  let current = null;

  for (let line of lines) {
    line = line.trim();
    if (line.startsWith("#EXTINF")) {
      current = {
        title: line.split(",").pop(),
        tvgName: (line.match(/tvg-name="(.*?)"/) || [])[1] || "",
        group: (line.match(/group-title="(.*?)"/) || [])[1] || "Other",
        tvgId: (line.match(/tvg-id="(.*?)"/) || [])[1] || "",
        tvgLogo: (line.match(/tvg-logo="(.*?)"/) || [])[1] || "",
        url: ""
      };
    } else if (line && !line.startsWith("#") && current) {
      current.url = line;
      items.push(current);
      current = null;
    } else if (line && !line.startsWith("#") && !current) {
      items.push({
        title: line,
        tvgName: "",
        group: "Other",
        tvgId: "",
        tvgLogo: "",
        url: line
      });
    }
  }
  return items;
}

// Helper to categorize items
export function categorizeItems(items) {
  const categories = {
    live: [],
    movies: [],
    series: []
  };
  
  items.forEach(item => {
    const url = (item.url || '').toLowerCase();
    const title = (item.tvgName || item.title || '').toLowerCase();
    
    if (url.includes('/series/') || /S\d{1,2}\s*E\d{1,2}/i.test(item.tvgName || item.title)) {
      categories.series.push(item);
    } else if (url.includes('/movie/') || url.endsWith('.mp4') || /movie|film|cinema/i.test(item.group)) {
      categories.movies.push(item);
    } else {
      categories.live.push(item);
    }
  });
  
  return categories;
}