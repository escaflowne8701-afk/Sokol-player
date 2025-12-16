const video=document.getElementById('video');
const params=new URLSearchParams(location.search);
video.src=params.get('url');

const controls=document.getElementById('controls');
let hideTimeout=null;

function showControls(){controls.classList.remove('hide');clearTimeout(hideTimeout);hideTimeout=setTimeout(()=>controls.classList.add('hide'),3000);}
document.body.onmousemove=showControls;

document.getElementById('playPause').onclick=function(){
 if(video.paused){video.play(); this.innerText='❚❚';}
 else{video.pause(); this.innerText='►';}
};

document.getElementById('rew').onclick=()=>video.currentTime=Math.max(0,video.currentTime-10);
document.getElementById('fwd').onclick=()=>video.currentTime=Math.min(video.duration,video.currentTime+10);

const seek=document.getElementById('seek');
seek.oninput=()=>video.currentTime=(seek.value/100)*video.duration;
video.ontimeupdate=()=>seek.value=(video.currentTime/video.duration)*100;

document.getElementById('fsBtn').onclick=()=>{
 if(!document.fullscreenElement) video.requestFullscreen();
 else document.exitFullscreen();
};