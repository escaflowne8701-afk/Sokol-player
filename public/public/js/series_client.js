// public/js/series_client.js - Fixed version
(async function(){
  const groupsList = document.getElementById('groupsList');
  const grid = document.getElementById('grid');
  const search = document.getElementById('search');

  try {
    const cats = await fetchCategories();
    const groups = cats.series || [];
    
    if (!groups.length) { 
      groupsList.innerHTML = '<div class="small">No series groups</div>'; 
      grid.innerHTML = '<div class="small">Upload a playlist with Series in Settings</div>';
      return; 
    }
    
    const itemsResponse = await fetch('/api/items/series/__ALL__');
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
      if(!el) return;
      
      // Remove active class from all
      document.querySelectorAll('.group-item').forEach(item => item.classList.remove('active'));
      // Add active class to clicked
      el.classList.add('active');
      
      const group = decodeURIComponent(el.dataset.group); 
      await loadShows(group);
    });

    // Auto load first group
    if (groups[0]) {
      const firstGroup = groupsList.querySelector('.group-item');
      if (firstGroup) {
        firstGroup.classList.add('active');
        await loadShows(groups[0]);
      }
    }

  } catch (error) {
    console.error('Failed to load categories:', error);
    groupsList.innerHTML = '<div class="small">Error loading categories</div>';
  }

  async function loadShows(group){
    grid.innerHTML = '<div class="small">Loading shows...</div>';
    
    try {
      const response = await fetch('/api/series_struct/' + encodeURIComponent(group));
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      const data = await response.json();
      const shows = Object.values(data);
      
      if (!shows.length) { 
        grid.innerHTML = '<div class="small">No shows in this group</div>'; 
        return; 
      }
      
      grid.innerHTML = shows.map(show => {
        const poster = show.poster || 'https://via.placeholder.com/400x260?text=No+Image';
        const title = escapeHtml(show.title || 'Unknown Show');
        const seasonCount = Object.keys(show.seasons || {}).length;
        const showJson = encodeURIComponent(JSON.stringify(show));
        
        return `
          <div class="card" data-title="${encodeURIComponent(show.title || '')}">
            <img src="${poster}" 
                 onerror="this.src='https://via.placeholder.com/400x260?text=No+Image'"
                 alt="${title}">
            <div class="title">${title}</div>
            <div class="small">
              ${seasonCount} Season${seasonCount !== 1 ? 's' : ''}
            </div>
            <div style="margin-top:8px">
              <button class="play-btn" onclick="openShowModalWrapper('${showJson}')">
                View Episodes
              </button>
            </div>
          </div>
        `;
      }).join('');
      
      // Reattach click events
      grid.addEventListener('click', (ev) => { 
        const el = ev.target.closest('.card'); 
        if(!el) return; 
        const title = decodeURIComponent(el.dataset.title); 
        const show = shows.find(x => x.title === title); 
        if(show) openShowModal(show); 
      });
      
    } catch(error) { 
      console.error('Failed to load shows:', error);
      grid.innerHTML = '<div class="small">Failed to load shows. Check console for details.</div>'; 
    }
  }

  window.openShowModal = function(show){
    let modal = document.getElementById('seriesModal'); 
    if(!modal){ 
      modal = document.createElement('div'); 
      modal.id = 'seriesModal'; 
      modal.className = 'modal'; 
      document.body.appendChild(modal); 
    }
    
    const seasonKeys = Object.keys(show.seasons || {}).sort((a,b) => parseInt(a) - parseInt(b));
    
    modal.innerHTML = `
      <div style="display:flex;gap:12px;align-items:flex-start">
        <img src="${show.poster || 'https://via.placeholder.com/120x160?text=No+Image'}" 
             style="width:120px;height:160px;object-fit:cover;border-radius:6px"
             onerror="this.src='https://via.placeholder.com/120x160?text=No+Image'">
        <div>
          <h3 style="margin:0">${escapeHtml(show.title || 'Unknown Show')}</h3>
          <div class="small">
            ${seasonKeys.length} Seasons
          </div>
        </div>
      </div>
      <div id="seasonsContainer" style="margin-top:20px;max-height:400px;overflow-y:auto"></div>
      <div style="margin-top:10px">
        <button onclick="closeModal()" class="play-btn" style="background:#777">Close</button>
      </div>
      <div id="playerBox" style="margin-top:10px"></div>
    `;
    
    const sc = modal.querySelector('#seasonsContainer');
    
    seasonKeys.forEach(seasonNum => { 
      const season = show.seasons[seasonNum];
      if (!season || !season.length) return;
      
      const sec = document.createElement('div'); 
      sec.className = 'season'; 
      sec.style.marginBottom = '20px';
      sec.innerHTML = `<strong style="display:block;margin-bottom:8px;font-size:16px">Season ${seasonNum}</strong>`;
      
      season.forEach(ep => { 
        const row = document.createElement('div'); 
        row.className = 'episode'; 
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';
        row.style.padding = '8px';
        row.style.borderBottom = '1px solid #333';
        
        row.innerHTML = `
          <div style="flex:1">
            <div style="font-weight:500">Episode ${ep.episode || ''}</div>
            <div class="small">${escapeHtml(ep.name || '')}</div>
          </div>
          <div>
            <button class="play-btn" onclick="playEpisode('${encodeURIComponent(ep.url || '')}', '${escapeHtml(show.title || '')} - S${seasonNum}:E${ep.episode || ''}')">
              Play
            </button>
          </div>
        `;
        sec.appendChild(row); 
      }); 
      
      sc.appendChild(sec); 
    });
  };

  window.openShowModalWrapper = function(showJson) {
    try {
      const show = JSON.parse(decodeURIComponent(showJson));
      openShowModal(show);
    } catch (e) {
      console.error('Failed to parse show data:', e);
    }
  };

  window.closeModal = function(){ 
    const m = document.getElementById('seriesModal'); 
    if(m) m.remove(); 
    const pb = document.getElementById('playerBox'); 
    if(pb) pb.innerHTML=''; 
    closeNetflixPlayer();
  };
  
  // Netflix-style player function
  window.playEpisode = function(encUrl, title = ''){
    const url = decodeURIComponent(encUrl);
    
    let existingPlayer = document.getElementById('netflixPlayerModal');
    if(existingPlayer) existingPlayer.remove();
    
    const playerModal = document.createElement('div');
    playerModal.id = 'netflixPlayerModal';
    playerModal.className = 'netflix-player-modal';
    
    playerModal.innerHTML = `
        <div class="netflix-player-container">
            <div class="netflix-player-header">
                <h3 class="netflix-player-title">${title || 'Now Playing'}</h3>
                <button class="netflix-player-close" onclick="closeNetflixPlayer()">×</button>
            </div>
            <div class="netflix-player-video">
                <video id="netflixSeriesPlayer" controls autoplay playsinline></video>
            </div>
            <div class="netflix-player-controls">
                <button class="netflix-play-btn-large" onclick="document.getElementById('netflixSeriesPlayer').play()">
                    ▶ Play
                </button>
                <button class="play-btn" style="background:#555" onclick="closeNetflixPlayer()">
                    Close
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(playerModal);
    
    const video = document.getElementById('netflixSeriesPlayer');
    const streamUrl = '/stream?url=' + encodeURIComponent(url);
    
    // Clean up existing HLS instance
    if(window._hls){ 
        try{window._hls.destroy();}catch(e){} 
        window._hls = null;
    }
    
    // Try HLS.js first for all IPTV streams
    if(window.Hls && Hls.isSupported()){
        const hls = new Hls({
            enableWorker: true,
            maxBufferLength: 30,
            maxMaxBufferLength: 60
        });
        window._hls = hls;
        
        hls.on(Hls.Events.ERROR, function(event, data) {
            if (data.fatal) {
                console.log('HLS fatal error, trying direct playback');
                hls.destroy();
                window._hls = null;
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
        video.src = streamUrl;
        video.play().catch(() => {});
    } else {
        video.src = streamUrl;
        video.play().catch(() => {});
    }
  };

  // Close Netflix player function
  window.closeNetflixPlayer = function(){
    const playerModal = document.getElementById('netflixPlayerModal');
    if(playerModal) playerModal.remove();
    
    const video = document.getElementById('netflixSeriesPlayer');
    if(video){
        video.pause();
        video.src = '';
        video.load();
    }
    
    if(window._hls){
        try{ window._hls.destroy(); }catch(e){}
        window._hls = null;
    }
  };

  // Search filter
  if (search) {
    search.addEventListener('input', () => {
      const q = search.value.toLowerCase();
      document.querySelectorAll('#grid .card').forEach(card => {
        const text = card.innerText.toLowerCase();
        card.style.display = text.includes(q) ? '' : 'none';
      });
    });
  }

})();