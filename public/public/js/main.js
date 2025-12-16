// public/js/main.js
const form = document.getElementById('uploadForm');
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const playlist = document.getElementById('playlistText').value.trim();
    if (!playlist) { alert('Paste playlist content or URL'); return; }

    const body = 'playlist=' + encodeURIComponent(playlist);

    const res = await fetch('/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });

    if (res.ok) { alert('Saved'); window.location.href = '/'; }
    else {
      const text = await res.text();
      alert('Upload failed: ' + text);
    }
  });
}
