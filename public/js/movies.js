// public/js/movies.js - Fixed version
(async function(){
  const groupsList = document.getElementById('groupsList');
  const grid = document.getElementById('grid');
  const search = document.getElementById('search');

  try {
    const cats = await fetchCategories();
    const groups = cats.movies || [];
    
    if (!groups.length) { 
      groupsList.innerHTML = '<div class="small">No movie groups</div>'; 
      grid.innerHTML = '<div class="small">Upload a playlist with Movies in Settings</div>';
      return; 
    }
    
    const itemsResponse = await fetch('/api/items/movies/__ALL__');
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
      await loadMovies(group);
    });

    // Auto load first group
    if (groups[0]) {
      const firstGroup = groupsList.querySelector('.group-item');
      if (firstGroup) {
        firstGroup.classList.add('active');
        await loadMovies(groups[0]);
      }
    }

  } catch (error) {
    console.error('Failed to load categories:', error);
    groupsList.innerHTML = '<div class="small">Error loading categories</div>';
  }

  async function loadMovies(group) {
    grid.innerHTML = '<div class="small">Loading movies...</div>';
    
    try {
      const response = await fetch(`/api/items/movies/${encodeURIComponent(group)}`);
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      const items = await response.json();
      
      if (!items.length) { 
        grid.innerHTML = '<div class="small">No movies in this group</div>'; 
        return; 
      }
      
      grid.innerHTML = items.map(item => {
        const logo = item.tvgLogo || 'https://via.placeholder.com/400x260?text=No+Image';
        const name = escapeHtml(item.tvgName || item.title || 'Unknown Movie');
        const encodedUrl = encodeURIComponent(item.url || '');
        const encodedName = encodeURIComponent(item.tvgName || item.title || 'Unknown Movie');
        
        return `
          <div class="card">
            <img src="${logo}" onerror="this.src='https://via.placeholder.com/400x260?text=No+Image'">
            <div class="title">${name}</div>
            <div style="margin-top:8px">
              <button class="play-btn" onclick="openNetflixMovieStream('${encodedUrl}', '${encodedName}')">
                Play
              </button>
            </div>
          </div>
        `;
      }).join('');
      
    } catch(error) { 
      console.error('Failed to load movies:', error);
      grid.innerHTML = '<div class="small">Failed to load movies. Check console for details.</div>'; 
    }
  }

  // Netflix-style movie player
  window.openNetflixMovieStream = function(encUrl, encTitle = ''){
    const url = decodeURIComponent(encUrl);
    const title = decodeURIComponent(encTitle);
    
    // Remove existing player modal
    let existingPlayer = document.getElementById('netflixMoviePlayerModal');
    if(existingPlayer) existingPlayer.remove();
    
    // Create Netflix-style player modal
    const playerModal = document.createElement('div');
    playerModal.id = 'netflixMoviePlayerModal';
    playerModal.className = 'netflix-player-modal';
    
    playerModal.innerHTML = `
        <div class="netflix-player-container">
            <div class="netflix-player-header">
                <h3 class="netflix-player-title">${title || 'Movie'}</h3>
                <button class="netflix-player-close" onclick="closeNetflixMoviePlayer()">×</button>
            </div>
            <div class="netflix-player-video">
                <video id="netflixMoviePlayer" controls autoplay playsinline></video>
            </div>
            <div class="netflix-player-controls">
                <button class="netflix-play-btn-large" onclick="document.getElementById('netflixMoviePlayer').play()">
                    ▶ Play
                </button>
                <button class="play-btn" style="background:#555" onclick="closeNetflixMoviePlayer()">
                    Close
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(playerModal);
    
    const video = document.getElementById('netflixMoviePlayer');
    
    if(window._hls_movie){ 
        try{window._hls_movie.destroy();}catch(e){} 
        window._hls_movie = null;
    }
    
    // Check if URL is HLS stream
    const isHLS = /\.m3u8/i.test(url);
    
    if(isHLS && window.Hls && Hls.isSupported()){
        const hls = new Hls({
            enableWorker: true,
            maxBufferLength: 30,
            maxMaxBufferLength: 60
        });
        window._hls_movie = hls;
        
        hls.on(Hls.Events.ERROR, function(event, data) {
            if (data.fatal) {
                console.log('HLS error, trying direct playback');
                hls.destroy();
                window._hls_movie = null;
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

  window.closeNetflixMoviePlayer = function(){
    const playerModal = document.getElementById('netflixMoviePlayerModal');
    if(playerModal) playerModal.remove();
    
    const video = document.getElementById('netflixMoviePlayer');
    if(video){
        video.pause();
        video.src = '';
        video.load();
    }
    
    if(window._hls_movie){
        try{ window._hls_movie.destroy(); }catch(e){}
        window._hls_movie = null;
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