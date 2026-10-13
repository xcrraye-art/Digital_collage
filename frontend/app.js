'use strict';
const NS = 'http://www.w3.org/2000/svg';
const GEM_ATLAS_URL = window.GEM_ATLAS_DATA || 'assets/gemstones.png';
const colors = [
  {name:'祖母绿',color:'#137448',dark:'#164a2a',shape:'drop'},
  {name:'玫红宝石',color:'#b33179',dark:'#8d315e',shape:'round'},
  {name:'石榴石',color:'#c05937',dark:'#8f3b2c',shape:'leaf'},
  {name:'黄水晶',color:'#d3ae43',dark:'#967a20',shape:'round'},
  {name:'海蓝宝',color:'#6293b1',dark:'#45748d',shape:'round'}
];
const templates = [
  {name:'翡翠花冠',tag:'花卉 · 大颗宝石',make:flower},
  {name:'春日枝语',tag:'植物 · 水滴与马眼切割',make:branch},
  {name:'繁星花海',tag:'花纹 · 细密连贴',make:field},
  {name:'相依的鸟儿',tag:'动物 · 密集宝石与心形',make:birds}
];
function ring(n,r,c,w,h,shape,offset=0){return Array.from({length:n},(_,i)=>{const a=i*Math.PI*2/n+offset;return{x:400+Math.sin(a)*r,y:400-Math.cos(a)*r,angle:a*180/Math.PI,c,w,h,shape}})}
function flower(){return [...ring(16,228,0,71,108,'drop'),...ring(16,155,1,48,48,'round',Math.PI/16),...ring(12,89,2,34,81,'leaf'),{x:400,y:400,angle:0,c:3,w:60,h:60,shape:'round'}]}
function branch(){const out=[];for(let i=0;i<11;i++){const y=190+i*39,x=380+Math.sin(i*.45)*55;out.push({x,y,c:3,w:16,h:16,shape:'round',angle:0});for(const side of [-1,1]){out.push({x:x+side*58,y:y-23,c:i%3===0?4:0,w:34,h:76,shape:'leaf',angle:side*48});out.push({x:x+side*104,y:y-53,c:1,w:23,h:23,shape:'round',angle:0});out.push({x:x+side*119,y:y-31,c:3,w:13,h:13,shape:'round',angle:0})}}return out.slice(0,67)}
function field(){const out=[{x:400,y:400,c:3,w:24,h:24,shape:'round',angle:0}];for(let k=1;k<=8;k++)out.push(...ring(k*6,k*33,k%5,17,20,k%3===0?'drop':'round',k*.13));return out}
function birds(){
  const out=[],ellipse=(x,y,cx,cy,rx,ry)=>((x-cx)/rx)**2+((y-cy)/ry)**2<=1;
  // Staggered gemstone rows form two original bird silhouettes.
  for(let row=0,y=215;y<605;row++,y+=14){for(let x=175+(row%2)*7;x<635;x+=14){
    const left=ellipse(x,y,295,437,108,146)||ellipse(x,y,324,306,78,78);
    const right=ellipse(x,y,505,455,95,132)||ellipse(x,y,466,342,74,72);
    if(!left&&!right)continue;
    let c=left?4:0,shape='round',w=11.5,h=11.5,angle=0;
    if(left&&ellipse(x,y,257,442,48,91)){c=0;shape='drop';h=13;angle=-25}
    if(right&&ellipse(x,y,533,471,44,88)){c=1;shape='leaf';h=13;angle=25}
    if(left&&y>470&&x>290)c=1;
    if(right&&x<490&&y>400&&y<515)c=4;
    if(ellipse(x,y,355,294,11,11)||ellipse(x,y,445,332,11,11)){c=2;w=12;h=12}
    out.push({x,y,c,w,h,shape,angle});
  }}
  // Beaks, tails and a golden branch; keep the index order stable for saves.
  out.push({x:402,y:322,c:3,w:24,h:18,shape:'leaf',angle:90},{x:402,y:349,c:3,w:22,h:17,shape:'leaf',angle:90});
  for(let y=594;y<684;y+=15)for(let x=265;x<328;x+=14)if(x<328-(y-594)*.32)out.push({x,y,c:4,w:11,h:14,shape:'drop',angle:-18});
  for(let y=589;y<694;y+=15)for(let x=486;x<549;x+=14)if(x>486+(y-589)*.24)out.push({x,y,c:0,w:11,h:14,shape:'drop',angle:15});
  for(let x=140;x<673;x+=14)out.push({x,y:602+(x-400)*.04,c:3,w:12,h:12,shape:'round',angle:0});
  [[220,180,22],[310,144,35],[396,171,52],[477,177,24],[556,224,43],[203,251,15],[541,133,18]].forEach(([x,y,w],i)=>out.push({x,y,w,h:w,c:i%2?1:3,shape:'heart',angle:(i%3-1)*10}));
  return out;
}
function path(shape){
  if(shape==='drop')return 'M0 -50 C-16 -36 -50 -9 -50 12 C-50 63 50 63 50 12 C50 -9 16 -36 0 -50Z';
  if(shape==='leaf')return 'M0 -50 Q-100 0 0 50 Q100 0 0 -50Z';
  if(shape==='heart')return 'M0 -30 C-33 -65 -72 -25 -42 7 L0 50 L42 7 C72 -25 33 -65 0 -30Z';
  return 'M0 -50 A50 50 0 1 1 0 50 A50 50 0 1 1 0 -50Z';
}
const cuts=['round','drop','leaf','heart'];
// Atlas crop rectangles are in a normalized 500 x 400 coordinate system.
// Each crop includes a little transparent margin, avoiding cuts at its rim.
const crops={"round": [[17.118, 10.339, 78.459, 78.431], [115.549, 10.695, 78.816, 78.431], [210.414, 10.695, 79.173, 78.431], [305.991, 10.695, 79.529, 78.431], [405.136, 10.695, 78.459, 78.431]], "drop": [[23.181, 95.544, 66.334, 91.266], [121.255, 95.9, 66.334, 90.909], [216.833, 95.544, 66.334, 91.266], [312.767, 95.544, 65.977, 91.266], [411.912, 95.544, 65.621, 91.266]], "leaf": [[30.314, 192.157, 51.355, 103.387], [128.745, 192.513, 51.712, 103.03], [224.322, 192.157, 51.712, 103.387], [319.9, 192.157, 51.355, 103.387], [418.688, 192.157, 52.068, 103.03]], "heart": [[13.909, 301.248, 83.452, 78.431], [113.409, 301.604, 82.739, 77.718], [208.274, 301.248, 83.452, 78.075], [303.495, 301.248, 84.522, 78.075], [403.352, 301.248, 83.452, 78.431]]};
function defs(prefix){
  return `<defs><filter id="${prefix}shadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="3" stdDeviation="2.1" flood-color="#372421" flood-opacity=".26"/></filter><filter id="${prefix}recess" x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur in="SourceAlpha" stdDeviation="2.6" result="blur"/><feOffset in="blur" dx="1.6" dy="2.8" result="shifted"/><feComposite in="shifted" in2="SourceAlpha" operator="out" result="rim"/><feFlood flood-color="white" flood-opacity="1"/><feComposite in2="rim" operator="in" result="highlight"/><feComposite in="SourceAlpha" in2="shifted" operator="out" result="inner"/><feGaussianBlur in="inner" stdDeviation="1.5" result="softInner"/><feFlood flood-color="#6e6570" flood-opacity=".55"/><feComposite in2="softInner" operator="in" result="shadow"/><feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="highlight"/><feMergeNode in="shadow"/></feMerge></filter>${cuts.map((shape,row)=>colors.map((_,c)=>{const [x,y,w,h]=crops[shape][c];return `<symbol id="${prefix}-${shape}-${c}" viewBox="${x} ${y} ${w} ${h}" preserveAspectRatio="none"><image href="${GEM_ATLAS_URL}" width="500" height="400" preserveAspectRatio="none"/></symbol>`}).join('')).join('')}</defs>`;
}
function jewel(s,prefix){return `<g class="jewel"><use href="#${prefix}-${s.shape}-${s.c}" x="-50" y="-50" width="100" height="100" filter="url(#${prefix}shadow)"/>${s.w>30?'<path class="gem-glint" d="M-20 -33 L-19 -24 -12 -23 -19 -22 -20 -13 -21 -22 -28 -23 -21 -24Z" fill="white"/>':''}</g>`}
let current=0,selected=0,mode='tap',scale=1,pan={x:0,y:0},items=[],filled=new Set(),history=[],sound=false,toastTimer,audioCtx;
const $=id=>document.getElementById(id),canvas=$('canvas');
function notify(msg){$('toast').textContent=msg;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),1800)}
function save(){try{localStorage.setItem('gem-garden-'+current,JSON.stringify([...filled]))}catch{notify('浏览器无法保存进度，本次仍可继续游玩')}}
function readSaved(i,total){try{const data=JSON.parse(localStorage.getItem('gem-garden-'+i)||'[]');return new Set(Array.isArray(data)?data.filter(n=>Number.isInteger(n)&&n>=0&&n<total):[])}catch{return new Set()}}
function load(i){
  releasePointers();current=i;items=templates[i].make();filled=readSaved(i,items.length);history=[];
  selected=items.find((s,id)=>!filled.has(id))?.c??0;scale=1;pan={x:0,y:0};
  document.body.className='game-screen';$('selection').hidden=true;document.querySelector('.studio').hidden=false;$('complete').hidden=true;
  $('title').textContent=templates[i].name;setMode('tap');render();transform();$('back').focus({preventScroll:true});
}
function slotContent(s,i){return `<g transform="scale(${s.w/100} ${s.h/100})">${filled.has(i)?jewel(s,'main'):`<path class="outline" d="${path(s.shape)}" fill="#f7f6f6" filter="url(#mainrecess)"/>`}</g>${!filled.has(i)?`<text transform="rotate(${-s.angle})" text-anchor="middle" dominant-baseline="central" fill="${selected===s.c?colors[s.c].dark:'#979198'}" style="font-size:${s.w<25?Math.max(5,s.w*.48):16}px">${s.c+1}</text>`:''}`}
function render(){canvas.innerHTML=defs('main')+items.map((s,i)=>`<g class="slot ${filled.has(i)?'placed':''} ${selected===s.c?'selected':''}" data-id="${i}" transform="translate(${s.x} ${s.y}) rotate(${s.angle})">${slotContent(s,i)}</g>`).join('');update();}
function selectColor(c){selected=c;canvas.querySelectorAll('.slot').forEach((el,i)=>{el.classList.toggle('selected',items[i].c===c);const t=el.querySelector('text');if(t)t.setAttribute('fill',items[i].c===c?colors[c].dark:'#979198')});update();}
function update(){
  const counts=colors.map(()=>({total:0,done:0}));items.forEach((s,i)=>{counts[s.c].total++;if(filled.has(i))counts[s.c].done++});
  const pct=Math.round(filled.size/items.length*100);$('percent').textContent=pct+'%';$('count').textContent=`${filled.size} / ${items.length} 颗`;$('progress').style.width=pct+'%';$('undo').disabled=!history.length;
  $('gem-name').textContent=colors[selected].name;
  // Keep palette buttons stable while placing a long stroke.
  if(!$('palette').children.length||$('palette').dataset.art!==String(current)){
    $('palette').innerHTML=colors.map((c,n)=>counts[n].total?`<button class="gem-choice" data-color="${n}" aria-label="${n+1}号 ${c.name}"><svg viewBox="-60 -60 120 120">${defs('p'+n)}${jewel({c:n,shape:items.find(s=>s.c===n).shape},'p'+n)}</svg><span></span></button>`:'').join('');$('palette').dataset.art=String(current);
  }
  $('palette').querySelectorAll('[data-color]').forEach(b=>{const n=Number(b.dataset.color),done=counts[n].done===counts[n].total;b.classList.toggle('active',n===selected);b.setAttribute('aria-pressed',n===selected);b.querySelector('span').textContent=done?'✓':n+1;b.title=`${colors[n].name} · 剩余 ${counts[n].total-counts[n].done} 颗`});
}
function chime(){if(!sound)return;try{audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();audioCtx.resume();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='sine';o.frequency.setValueAtTime(650+selected*120,audioCtx.currentTime);g.gain.setValueAtTime(.045,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+.17);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+.18)}catch{}}
function place(id){
  const s=items[id];if(!s||filled.has(id))return;
  if(s.c!==selected){if(mode==='tap')notify(`这里需要 ${s.c+1} 号${colors[s.c].name}`);return}
  filled.add(id);history.push(id);save();const el=canvas.querySelector(`[data-id="${id}"]`);el.classList.add('placed','just-placed');el.innerHTML=slotContent(s,id);setTimeout(()=>el.classList.remove('just-placed'),400);
  const star=document.createElementNS(NS,'g');star.setAttribute('transform',`translate(${s.x} ${s.y})`);star.innerHTML=`<path class="spark" d="M0 -24 L3 -4 17 0 3 4 0 24 -3 4 -17 0 -3 -4Z"/><circle class="spark-ring" r="${Math.max(12,s.w*.5)}"/>`;canvas.append(star);setTimeout(()=>star.remove(),650);
  chime();update();if(filled.size===items.length){releasePointers();$('complete').hidden=false}else if(items.every((x,i)=>x.c!==selected||filled.has(i))){selectColor(items.find((x,i)=>!filled.has(i)).c);notify('这一种宝石贴完了，继续下一种吧')}
}
function transform(){canvas.style.transform=`translate(${pan.x}px,${pan.y}px) scale(${scale})`;$('zoom').textContent=Math.round(scale*100)+'%';}
function zoom(delta){scale=Math.max(.7,Math.min(8,scale+delta));transform();}
function setMode(next){mode=next;document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));$('hint').textContent=mode==='pan'?'拖动画布移动 · 双指缩放':mode==='paint'?'按住划过相同编号连续贴放 · 双指缩放':'点击对应编号 · 双指缩放查看细节';$('viewport').classList.toggle('panning',mode==='pan')}
function renderGallery(){
  $('gallery').innerHTML=templates.map((t,i)=>{const list=t.make(),saved=readSaved(i,list.length),pct=Math.round(saved.size/list.length*100);return `<button class="art-card" data-art="${i}" aria-label="选择${t.name}"><div class="art-frame"><svg viewBox="80 80 640 640" aria-hidden="true">${defs('thumb'+i)}${list.map((s,n)=>`<g transform="translate(${s.x} ${s.y}) rotate(${s.angle}) scale(${s.w/100} ${s.h/100})">${jewel(s,'thumb'+i)}</g>`).join('')}</svg></div><span><strong>${t.name}</strong><small>${t.tag} · ${list.length} 颗</small><em>${saved.size?`已完成 ${pct}%`:'开始贴画'}</em></span><span class="arrow">↗</span></button>`}).join('');
}
$('gallery').onclick=e=>{const b=e.target.closest('[data-art]');if(b)load(Number(b.dataset.art))};$('palette').onclick=e=>{const b=e.target.closest('[data-color]');if(b)selectColor(Number(b.dataset.color))};document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
const pointers=new Map();let last=null,pinch=null;
function releasePointers(){for(const id of pointers.keys()){if($('viewport').hasPointerCapture(id))$('viewport').releasePointerCapture(id)}pointers.clear();last=null;pinch=null;}
function pointerPair(){const [a,b]=[...pointers.values()];return{distance:Math.hypot(a.x-b.x,a.y-b.y),mid:{x:(a.x+b.x)/2,y:(a.y+b.y)/2}}}
function hit(p){const el=document.elementFromPoint(p.x,p.y)?.closest('[data-id]');if(el)place(Number(el.dataset.id))}
$('viewport').addEventListener('pointerdown',e=>{
  if(e.target.closest('button')||!$('complete').hidden||e.button>0)return;
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});$('viewport').setPointerCapture(e.pointerId);
  if(pointers.size===2){pinch=pointerPair();last=null;return}
  if(pointers.size>2)return;last={x:e.clientX,y:e.clientY};
  // For touch, wait until release to distinguish a tap from a two-finger gesture.
  if(e.pointerType!=='touch'&&mode!=='pan')hit(last);
});
$('viewport').addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId))return;
  const point={x:e.clientX,y:e.clientY};pointers.set(e.pointerId,point);
  if(pointers.size===2){const next=pointerPair();if(pinch&&pinch.distance>0){const rect=$('viewport').getBoundingClientRect(),old=scale;scale=Math.max(.7,Math.min(8,scale*next.distance/pinch.distance));const ratio=scale/old;pan.x=(pan.x-(pinch.mid.x-rect.left-rect.width/2))*ratio+(next.mid.x-rect.left-rect.width/2);pan.y=(pan.y-(pinch.mid.y-rect.top-rect.height/2))*ratio+(next.mid.y-rect.top-rect.height/2);transform()}pinch=next;return}
  if(!last||pinch)return;
  if(mode==='pan'){pan.x+=point.x-last.x;pan.y+=point.y-last.y;transform()}
  else if(mode==='paint'){const dx=point.x-last.x,dy=point.y-last.y,n=Math.max(1,Math.ceil(Math.hypot(dx,dy)/3));for(let i=0;i<=n;i++)hit({x:last.x+dx*i/n,y:last.y+dy*i/n})}
  last=point;
});
function pointerEnd(e){
  if(!pointers.has(e.pointerId))return;
  if(e.type==='pointerup'&&pointers.size===1&&!pinch&&e.pointerType==='touch'&&mode!=='pan')hit({x:e.clientX,y:e.clientY});
  pointers.delete(e.pointerId);last=null;if(!pointers.size)pinch=null;
}
for(const name of ['pointerup','pointercancel','lostpointercapture'])$('viewport').addEventListener(name,pointerEnd);
$('viewport').addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY>0?-.2:.2)},{passive:false});$('plus').onclick=()=>zoom(.4);$('minus').onclick=()=>zoom(-.4);$('fit').onclick=()=>{scale=1;pan={x:0,y:0};transform()};
$('undo').onclick=()=>{if(history.length){filled.delete(history.pop());save();$('complete').hidden=true;render()}};
$('reset').onclick=()=>{if(confirm('要清空这幅画的进度，重新开始吗？')){filled.clear();history=[];save();render();$('complete').hidden=true}};
$('continue').onclick=()=>{$('complete').hidden=true};$('sound').onclick=()=>{sound=!sound;$('sound').textContent=sound?'♫ 音效开':'♫ 音效关';$('sound').setAttribute('aria-pressed',sound);if(sound)chime()};
$('back').onclick=()=>{releasePointers();document.body.className='selection-screen';$('selection').hidden=false;document.querySelector('.studio').hidden=true;renderGallery();$('gallery').querySelector(`[data-art="${current}"]`).focus({preventScroll:true})};
const preload=new Image();preload.src=GEM_ATLAS_URL;preload.onerror=()=>notify('宝石素材加载失败，请检查网络或重新下载完整文件');renderGallery();
