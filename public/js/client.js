async function load(type){
 const cats=await (await fetch('/api/categories')).json();
 const groups=['⭐ Favorites','All',...(cats[type]||[])];
 const gl=document.getElementById('groups');
 gl.innerHTML=groups.map(g=>`<div class="g" data-g="${g}">${g}</div>`).join('');
 gl.onclick=async e=>{
  const g=e.target.dataset.g;
  let items=[];
  if(g==='⭐ Favorites'){
    items=Fav.all().filter(x=>x.type===type);
  }else{
    const key=g==='All'?'__ALL__':encodeURIComponent(g);
    items=await (await fetch(`/api/items/${type}/${key}`)).json();
  }
  const grid=document.getElementById('grid');
  grid.innerHTML=items.map(i=>`
    <div class="card">
      <img src="${i.logo||'https://via.placeholder.com/300x200'}">
      <div>${i.title}</div>
      <button onclick="play('${i.url}')">Play</button>
      <button onclick="Fav.toggle({url:'${i.url}',title:'${i.title}',logo:'${i.logo}',type:'${type}'})">⭐</button>
    </div>`).join('');
 };
}

function play(url){
 const p=document.getElementById('player');
 p.innerHTML=`<video controls autoplay src="${url}" style="width:100%"></video>`;
}
