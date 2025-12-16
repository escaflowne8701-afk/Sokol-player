(function(){
  const video = document.getElementById('npVideo');
  const playBtn = document.getElementById('npPlay');
  const rew = document.getElementById('npRew');
  const fwd = document.getElementById('npFwd');
  const seek = document.getElementById('npSeek');
  const timeEl = document.getElementById('npTime');
  const volume = document.getElementById('npVolume');
  const fs = document.getElementById('npFS');
  const back = document.getElementById('npBack');
  const audioSelect = document.getElementById('audioTracks');
  const subSelect = document.getElementById('subTracks');
  const proxied = window.NP_PROXIED || '';
  const NEXT = window.NP_NEXT || '';
  let hls=null;

  function loadSource(){
    if(!proxied){ alert('Missing stream'); history.back(); return; }
    if(window.Hls && Hls.isSupported() && /\.m3u8/i.test(window.NP_STREAM||proxied)){
      hls = new Hls();
      hls.loadSource(proxied);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, function() { video.play().catch(()=>{}); populateTracks(); });
      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, populateTracks);
      hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, populateTracks);
    } else {
      video.src = proxied;
      video.load();
      video.play().catch(()=>{});
      audioSelect.style.display='none';
      subSelect.style.display='none';
    }
  }

  function populateTracks(){
    try{
      const audios = (hls && hls.audioTracks) ? hls.audioTracks : [];
      audioSelect.innerHTML='';
      if(audios.length>0){
        audios.forEach((a,i)=>{ const opt=document.createElement('option'); opt.value=i; opt.text=a.name||('Audio '+i); audioSelect.appendChild(opt); });
        audioSelect.onchange = ()=> { hls.audioTrack = parseInt(audioSelect.value); };
        audioSelect.style.display='inline-block';
      } else audioSelect.style.display='none';

      const subs = (hls && hls.subtitleTracks) ? hls.subtitleTracks : [];
      subSelect.innerHTML='';
      if(subs.length>0){
        const off=document.createElement('option'); off.value=-1; off.text='Subs Off'; subSelect.appendChild(off);
        subs.forEach((s,i)=>{ const opt=document.createElement('option'); opt.value=i; opt.text=s.name||('Subtitle '+i); subSelect.appendChild(opt); });
        subSelect.onchange = ()=> { hls.subtitleTrack = parseInt(subSelect.value); };
        subSelect.style.display='inline-block';
      } else subSelect.style.display='none';
    }catch(e){ audioSelect.style.display='none'; subSelect.style.display='none'; }
  }

  function ftime(s){ if(!isFinite(s)) return '0:00'; const m=Math.floor(s/60); const sec=Math.floor(s%60); return m+':'+(sec<10?'0'+sec:sec); }
  video.addEventListener('loadedmetadata', ()=>{ seek.max = Math.floor(video.duration) || 0; timeEl.textContent = ftime(0) + ' / ' + ftime(video.duration); });
  video.addEventListener('timeupdate', ()=>{ seek.value = Math.floor(video.currentTime); timeEl.textContent = ftime(video.currentTime) + ' / ' + ftime(video.duration); });

  if(playBtn) playBtn.addEventListener('click', ()=>{ if(video.paused){ video.play(); playBtn.textContent='❚❚'; } else { video.pause(); playBtn.textContent='►'; } });
  if(rew) rew.addEventListener('click', ()=> video.currentTime = Math.max(0, video.currentTime-10));
  if(fwd) fwd.addEventListener('click', ()=> video.currentTime = Math.min(video.duration, video.currentTime+10));
  if(seek) seek.addEventListener('input', ()=> video.currentTime = seek.value);
  if(volume) volume.addEventListener('input', ()=> video.volume = volume.value);
  if(fs) fs.addEventListener('click', ()=>{ if(!document.fullscreenElement) document.documentElement.requestFullscreen().catch(()=>{}); else document.exitFullscreen().catch(()=>{}); });
  if(back) back.addEventListener('click', ()=> history.back());

  document.addEventListener('keydown', (e)=>{ if(e.code==='Space'){ e.preventDefault(); if(playBtn) playBtn.click(); } if(e.key==='ArrowRight'){ if(fwd) fwd.click(); } if(e.key==='ArrowLeft'){ if(rew) rew.click(); } if(e.key==='KeyF'){ if(fs) fs.click(); } });

  loadSource();
})();