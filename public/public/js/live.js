// public/js/live.js - Fixed version
(async function(){
  const groupsList = document.getElementById('groupsList');
  const container = document.getElementById('groups');
  const search = document.getElementById('search');

  try {
    const cats = await fetchCategories();
    const groups = cats.live || [];
    
    if (!groups.length) { 
      groupsList.innerHTML = '<div class="small">No live groups</div>'; 
      container.innerHTML = '<div class="small">Upload a playlist with Live TV channels in Settings</div>';
      return; 
    }
    
    const itemsResponse = await fetch('/api/items/live/__ALL__');
    const allItems = await itemsResponse.json();
    const groupCounts = {};
    allItems.forEach(item => {
      const g = item.group || 'Other';
      groupCounts[g] = (groupCounts[g] || 0) + 1;
    });
    
    groupsList.innerHTML = `<div class="group-item" data-group="__ALL__">All Categories (${allItems.length})</div>` + 
      groups.map(g => 
        `<div class="group-item" data-group="${encodeURIComponent(g)}">${g} (${groupCounts[g] || 0})</div>`
      ).join('');

    groupsList.addEventListener('click', async (ev) => {
      const el = ev.target.closest('.group-item');
      if (!el) return;
      
      // Remove active class from all
      document.querySelectorAll('.group-item').forEach(item => item.classList.remove('active'));
      // Add active class to clicked
      el.classList.add('active');
      
      const group = decodeURIComponent(el.dataset.group);
      await loadLive(group);
    });

    // Auto load first group
    if (groups[0]) {
      const firstGroup = groupsList.querySelector('.group-item');
      if (firstGroup) {
        firstGroup.classList.add('active');
        await loadLive(groups[0]);
      }
    }

  } catch (error) {
    console.error('Failed to load categories:', error);
    groupsList.innerHTML = '<div class="small">Error loading categories</div>';
  }

  async function loadLive(group) {
    container.innerHTML = '<div class="small">Loading channels...</div>';
    
    try {
      const response = await fetch(`/api/items/live/${encodeURIComponent(group)}`);
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      const items = await response.json();
      
      if (!items.length) { 
        container.innerHTML = '<div class="small">No channels in this group</div>'; 
        return; 
      }
      
      container.innerHTML = items.map(item => {
        const logo = item.tvgLogo || '';
        const name = escapeHtml(item.tvgName || item.title || 'Unknown Channel');
        const encodedUrl = encodeURIComponent(item.url || '');
        
        return `
          <div class="card">
            ${logo ? `<img src="${logo}" onerror="this.style.display='none'">` : ''}
            <div class="title">${name}</div>
            <div style="margin-top:8px">
              <button class="play-btn" onclick="openNetflixLiveStream('${encodedUrl}', '${name}')">
                Play
              </button>
            </div>
          </div>
        `;
      }).join('');
      
    } catch(error) { 
      console.error('Failed to load live channels:', error);
      container.innerHTML = '<div class="small">Failed to load channels. Check console for details.</div>'; 
    }
  }

  // Netflix-style live stream player
  window.openNetflixLiveStream = function(encUrl, title = ''){
    const url = decodeURIComponent(encUrl);
    
    // Remove existing player modal
    let existingPlayer = document.getElementById('netflixLivePlayerModal');
    if(existingPlayer) existingPlayer.remove();
    
    // Create Netflix-style player modal
    const playerModal = document.createElement('div');
    playerModal.id = 'netflixLivePlayerModal';
    playerModal.className = 'netflix-player-modal';
    
    playerModal.innerHTML = `
        <div class="netflix-player-container">
            <div class="netflix-player-header">
                <h3 class="netflix-player-title">${title || 'Live Channel'}</h3>
                <button class="netflix-player-close" onclick="closeNetflixLivePlayer()">×</button>
            </div>
            <div class="netflix-player-video">
                <video id="netflixLivePlayer" controls autoplay playsinline></video>
            </div>
            <div class="netflix-player-controls">
                <button class="netflix-play-btn-large" onclick="document.getElementById('netflixLivePlayer').play()">
                    ▶ Play
                </button>
                <button class="play-btn" style="background:#555" onclick="closeNetflixLivePlayer()">
                    Close
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(playerModal);
    
    const video = document.getElementById('netflixLivePlayer');
    
    // Use proxy
    const streamUrl = '/stream?url=' + encodeURIComponent(url);
    
    // Clean up existing HLS instance
    if(window._hls_live){ 
        try{window._hls_live.destroy();}catch(e){} 
        window._hls_live = null;
    }
    
    // Try HLS.js first for all IPTV streams (many don't have .m3u8 extension)
    if(window.Hls && Hls.isSupported()){
        const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 30,
            maxBufferLength: 30,
            maxMaxBufferLength: 60
        });
        window._hls_live = hls;
        
        hls.on(Hls.Events.ERROR, function(event, data) {
            if (data.fatal) {
                console.log('HLS fatal error, trying direct playback');
                hls.destroy();
                window._hls_live = null;
                // Fallback to direct video playback
                video.src = streamUrl;
                video.play().catch(() => {});
            }
        });
        
        hls.loadSource(streamUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
            video.play().catch(() => {});
        });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari)
        video.src = streamUrl;
        video.play().catch(() => {});
    } else {
        // Direct playback fallback
        video.src = streamUrl;
        video.play().catch(() => {});
    }
  };

  window.closeNetflixLivePlayer = function(){
    const playerModal = document.getElementById('netflixLivePlayerModal');
    if(playerModal) playerModal.remove();
    
    const video = document.getElementById('netflixLivePlayer');
    if(video){
        video.pause();
        video.src = '';
        video.load();
    }
    
    if(window._hls_live){
        try{ window._hls_live.destroy(); }catch(e){}
        window._hls_live = null;
    }
  };

  // Search filter
  if (search) {
    search.addEventListener('input', () => {
      const q = search.value.toLowerCase();
      document.querySelectorAll('#groups .card').forEach(card => {
        const text = card.innerText.toLowerCase();
        card.style.display = text.includes(q) ? '' : 'none';
      });
    });
  }

})();