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
    if(modal) modal.remove();
    
    modal = document.createElement('div'); 
    modal.id = 'seriesModal'; 
    modal.className = 'netflix-series-modal'; 
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    
    const seasonKeys = Object.keys(show.seasons || {}).sort((a,b) => parseInt(a) - parseInt(b));
    const totalEpisodes = seasonKeys.reduce((sum, s) => sum + (show.seasons[s]?.length || 0), 0);
    const firstSeason = seasonKeys[0] || '1';
    
    modal.innerHTML = `
      <div class="netflix-series-container">
        <button class="netflix-series-close" onclick="closeModal()">×</button>
        
        <div class="netflix-series-hero">
          <div class="netflix-series-poster">
            <img src="${show.poster || 'https://via.placeholder.com/350x500?text=No+Image'}" 
                 onerror="this.src='https://via.placeholder.com/350x500?text=No+Image'"
                 alt="${escapeHtml(show.title || '')}">
          </div>
          
          <div class="netflix-series-info">
            <h1 class="netflix-series-title">${escapeHtml(show.title || 'Unknown Show')}</h1>
            
            <div class="netflix-series-meta">
              <span class="netflix-series-meta-item seasons">${seasonKeys.length} Season${seasonKeys.length !== 1 ? 's' : ''}</span>
              <span class="netflix-series-meta-item episodes">${totalEpisodes} Episode${totalEpisodes !== 1 ? 's' : ''}</span>
            </div>
            
            <div class="netflix-series-summary">
              Watch all episodes of ${escapeHtml(show.title || 'this series')}. Select a season below to browse episodes and start watching instantly.
            </div>
            
            <div class="netflix-series-actions">
              <button class="netflix-play-all-btn" onclick="playFirstEpisode()">
                <span style="font-size:20px">▶</span> Play First Episode
              </button>
              <button class="netflix-add-list-btn" title="Add to favorites">+</button>
            </div>
          </div>
        </div>
        
        <div class="netflix-content-section">
          <div class="netflix-seasons-panel">
            <div class="netflix-seasons-title">Seasons</div>
            <div class="netflix-season-buttons" id="seasonButtons">
              ${seasonKeys.map((s, idx) => `
                <button class="netflix-season-btn ${idx === 0 ? 'active' : ''}" data-season="${s}" onclick="selectSeason('${s}')">
                  Season ${s}
                  <span class="episode-count">${show.seasons[s]?.length || 0} ep</span>
                </button>
              `).join('')}
            </div>
          </div>
          
          <div class="netflix-episodes-panel" id="episodesPanel">
            <div class="netflix-episodes-title">
              <span id="currentSeasonLabel">Season ${firstSeason}</span>
            </div>
            <div id="episodesList"></div>
          </div>
        </div>
      </div>
    `;
    
    window._currentShow = show;
    window._currentSeasonKeys = seasonKeys;
    
    if (seasonKeys.length > 0) {
      selectSeason(firstSeason);
    }
  };
  
  window.selectSeason = function(seasonNum) {
    const show = window._currentShow;
    if (!show) return;
    
    document.querySelectorAll('.netflix-season-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.season === seasonNum) btn.classList.add('active');
    });
    
    const label = document.getElementById('currentSeasonLabel');
    if (label) label.textContent = `Season ${seasonNum}`;
    
    const episodes = show.seasons[seasonNum] || [];
    const container = document.getElementById('episodesList');
    if (!container) return;
    
    container.innerHTML = episodes.map((ep, idx) => {
      const encodedUrl = encodeURIComponent(ep.url || '');
      const encodedTitle = encodeURIComponent(`${show.title || ''} - S${seasonNum}:E${ep.episode || ''}`);
      return `
      <div class="netflix-episode-card" onclick="playEpisode('${encodedUrl}', '${encodedTitle}')">
        <div class="netflix-episode-number">${ep.episode || idx + 1}</div>
        <div class="netflix-episode-thumb">
          <img src="${ep.logo || show.poster || 'https://via.placeholder.com/160x90?text=Episode'}" 
               onerror="this.src='https://via.placeholder.com/160x90?text=Episode+${ep.episode || idx + 1}'"
               alt="Episode ${ep.episode || idx + 1}">
          <div class="play-overlay"></div>
        </div>
        <div class="netflix-episode-info">
          <div class="netflix-episode-title">Episode ${ep.episode || idx + 1}</div>
          <div class="netflix-episode-desc">${escapeHtml(ep.name || '')}</div>
        </div>
        <div class="netflix-episode-play">
          <button class="netflix-episode-play-btn" onclick="event.stopPropagation(); playEpisode('${encodedUrl}', '${encodedTitle}')">
            ▶ Play
          </button>
        </div>
      </div>
    `}).join('');
  };
  
  window.playFirstEpisode = function() {
    const show = window._currentShow;
    const seasonKeys = window._currentSeasonKeys;
    if (!show || !seasonKeys || seasonKeys.length === 0) return;
    
    const firstSeason = seasonKeys[0];
    const episodes = show.seasons[firstSeason];
    if (episodes && episodes.length > 0) {
      const ep = episodes[0];
      const encodedUrl = encodeURIComponent(ep.url || '');
      const encodedTitle = encodeURIComponent(`${show.title || ''} - S${firstSeason}:E${ep.episode || 1}`);
      playEpisode(encodedUrl, encodedTitle);
    }
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
    document.body.style.overflow = '';
    window._currentShow = null;
    window._currentSeasonKeys = null;
    closeNetflixPlayer();
  };
  
  // Netflix-style player function
  window.playEpisode = function(encUrl, encTitle = ''){
    const url = decodeURIComponent(encUrl);
    const title = decodeURIComponent(encTitle);
    
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
    
    if(window._hls){ 
        try{window._hls.destroy();}catch(e){} 
        window._hls = null;
    }
    
    // Check if URL is HLS stream
    const isHLS = /\.m3u8/i.test(url);
    
    if(isHLS && window.Hls && Hls.isSupported()){
        const hls = new Hls({
            enableWorker: true,
            maxBufferLength: 30,
            maxMaxBufferLength: 60
        });
        window._hls = hls;
        
        hls.on(Hls.Events.ERROR, function(event, data) {
            if (data.fatal) {
                console.log('HLS error, trying direct playback');
                hls.destroy();
                window._hls = null;
                video.src = url;
                video.play().catch(() => {});
            }
        });
        
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
            video.play().catch(() => {});
        });
    } else if (isHLS && video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native HLS
        video.src = url;
        video.play().catch(() => {});
    } else {
        // Direct playback for non-HLS (mkv, mp4, etc)
        video.src = url;
        video.load();
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