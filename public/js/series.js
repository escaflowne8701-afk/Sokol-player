// public/js/series.js
(async function(){
  try {
    const text = await fetchPlaylistFromServer();
    parseM3U(text);
  } catch (e) {
    document.getElementById('seriesGrid').innerHTML = '<div class="small muted">No playlist found. Upload in Settings.</div>';
    return;
  }

  const series = (window._channels||[]).filter(c=> pickTypeForChannel(c) === 'series');
  const groups = {};
  series.forEach(c=>{ const g = c.group||'Other'; if(!groups[g]) groups[g]=[]; groups[g].push(c); });

  const seriesGroups = document.getElementById('seriesGroups'); seriesGroups.innerHTML='';
  const gNames = sortGroups(Object.keys(groups));
  
  const allEl = document.createElement('div'); allEl.className='cat-item'; allEl.textContent = `All Categories (${series.length})`;
  allEl.onclick = ()=> showSeriesForGroup('__ALL__');
  seriesGroups.appendChild(allEl);
  
  gNames.forEach(g=>{
    const el = document.createElement('div'); el.className='cat-item'; el.textContent = `${g} (${groups[g].length})`;
    el.onclick = ()=> showSeriesForGroup(g);
    seriesGroups.appendChild(el);
  });

  function showSeriesForGroup(g){
    const arr = g === '__ALL__' ? series : (groups[g] || []);
    const grid = document.getElementById('seriesGrid'); grid.innerHTML='';
    if (!arr.length) { grid.innerHTML = '<div class="small muted">No items</div>'; return; }
    arr.forEach(s=>{
      const card = document.createElement('div'); card.className='card';
      card.innerHTML = `<img src="${s.logo||''}" onerror="this.style.visibility='hidden'"><div style="margin-top:8px;font-weight:600">${escapeHtml(s.name)}</div>`;
      card.addEventListener('click', ()=> {
        localStorage.setItem('lastPlayUrl', s.url);
        window.location.href = 'live.html';
      });
      grid.appendChild(card);
    });
  }

  if (gNames.length) showSeriesForGroup(gNames[0]);
})();
