'use strict';
const $ = id => document.getElementById(id);
const canvas = $('canvas'), viewport = $('viewport'), context = canvas.getContext('2d', {alpha:false});
const colors = [
  {name:'祖母绿',dark:'#164a2a'}, {name:'玫红宝石',dark:'#8d315e'},
  {name:'石榴石',dark:'#8f3b2c'}, {name:'黄水晶',dark:'#967a20'}, {name:'海蓝宝',dark:'#45748d'}
];
const WORLD=800, CACHE_SCALE=2, SPRITE_SIZE=256, PAD=16, CELL=64;
let data, atlas, sprites=new Map(), layouts=[], current=0, items=[], filled=new Set(), history=[], activeStroke=[];
const shapeNames={round:"圆形",drop:"水滴形",leaf:"马眼形",heart:"心形"};
let types=[],totals=[], done=[], selected=0, mode='tap', zoom=1, pan={x:0,y:0}, width=1,height=1,fit=1,dpr=1;
let slotsLayer, index=new Map(), frame=0, points=[], strokeEnd=false, uiDirty=false, saveDirty=false, sceneDirty=false, cameraMoving=false, cameraTimer;
let sound=false, audioCtx, saveTimer, toastTimer, sparks=[], pendingCache=false;
const pointers=new Map(); let last=null,pinch=null,touchStart=null,touchMoved=false,focusId=-1,holdTimer=0,holdPicked=false;
const hitContext=document.createElement('canvas').getContext('2d');

function notify(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2200)}
function key(i=current){return `gem-garden-v3-${layouts[i].id}`}
function saved(i){try{const raw=JSON.parse(localStorage.getItem(key(i))||'[]');return new Set(Array.isArray(raw)?raw.filter(n=>Number.isInteger(n)&&n>=0&&n<layouts[i].items.length):[])}catch{return new Set()}}
function flushSave(){clearTimeout(saveTimer);if(!saveDirty)return;try{localStorage.setItem(key(),JSON.stringify([...filled]));saveDirty=false}catch{notify('无法保存进度，本次仍可继续游玩')}}
function deferSave(){saveDirty=true;clearTimeout(saveTimer);saveTimer=setTimeout(flushSave,350)}
function makeCanvas(w,h=w){const c=document.createElement('canvas');c.width=w;c.height=h;return c}
function makePath(outline){
  // Round small alpha-tracing steps, preserving deliberate cut tips. Curves stay
  // inside the original convex hull used by the offline spacing checks.
  const path=new Path2D(),last=outline[outline.length-1],first=outline[0];path.moveTo((last[0]+first[0])/2,(last[1]+first[1])/2);
  outline.forEach((p,i)=>{const prev=outline[(i+outline.length-1)%outline.length],next=outline[(i+1)%outline.length],a=Math.hypot(p[0]-prev[0],p[1]-prev[1]),b=Math.hypot(next[0]-p[0],next[1]-p[1]);const cosine=((p[0]-prev[0])*(next[0]-p[0])+(p[1]-prev[1])*(next[1]-p[1]))/(a*b||1),x=(p[0]+next[0])/2,y=(p[1]+next[1])/2;if(cosine<.35&&Math.min(a,b)>.045){path.lineTo(...p);path.lineTo(x,y)}else path.quadraticCurveTo(p[0],p[1],x,y)});path.closePath();return path;
}
function prepareSprites(){
  for(const [id,g] of Object.entries(data.gems)){
    const path=makePath(g.outline),size=SPRITE_SIZE+PAD*2;
    const mask=makeCanvas(size),mc=mask.getContext('2d');
    mc.translate(size/2,size/2);mc.scale(SPRITE_SIZE,SPRITE_SIZE);mc.fillStyle='#fff';mc.fill(path);
    const base=makeCanvas(size),bc=base.getContext('2d');bc.translate(size/2,size/2);bc.scale(SPRITE_SIZE,SPRITE_SIZE);bc.clip(path);
    bc.drawImage(atlas,...g.crop,-.5,-.5,1,1);
    const gem=makeCanvas(size),gc=gem.getContext('2d');gc.shadowColor='rgba(55,35,40,.26)';gc.shadowBlur=5;gc.shadowOffsetY=3;gc.drawImage(base,0,0);
    // Bake the light rim and inner shadow once. Runtime draws use no filters.
    const inverse=makeCanvas(size),ic=inverse.getContext('2d');ic.fillStyle='#776b73';ic.fillRect(0,0,size,size);ic.globalCompositeOperation='destination-out';ic.drawImage(mask,0,0);
    const socket=makeCanvas(size),sc=socket.getContext('2d');sc.translate(size/2,size/2);sc.scale(SPRITE_SIZE,SPRITE_SIZE);sc.clip(path);sc.setTransform(1,0,0,1,0,0);sc.fillStyle='#f8f6f7';sc.fillRect(0,0,size,size);
    sc.shadowColor='rgba(90,78,86,.55)';sc.shadowBlur=8;sc.globalAlpha=.7;sc.drawImage(inverse,4,5);sc.globalAlpha=1;
    const rim=makeCanvas(size),rc=rim.getContext('2d');rc.shadowColor='white';rc.shadowBlur=3;rc.drawImage(mask,0,1.5);
    const finalSocket=makeCanvas(size),fc=finalSocket.getContext('2d');fc.drawImage(rim,0,0);fc.drawImage(socket,0,0);
    const socketActive=makeCanvas(size),ac=socketActive.getContext('2d');ac.drawImage(finalSocket,0,0);ac.translate(size/2,size/2);ac.scale(SPRITE_SIZE,SPRITE_SIZE);ac.fillStyle='rgba(196,167,185,.12)';ac.fill(path);ac.strokeStyle='rgba(173,127,151,.4)';ac.lineWidth=.003;ac.stroke(path);
    sprites.set(id,{path,gem,socket:finalSocket,socketActive});
    for(const temporary of [mask,base,inverse,rim,socket])temporary.width=0;
  }
}
const glyphs=new Map();
function typeName(id){const t=types[id];return `${colors[t.c].name} · ${shapeNames[t.shape]}`}
function glyph(typeId,active){const t=types[typeId],id=`${t.key}-${typeId}-${active}`;if(glyphs.has(id))return glyphs.get(id);const c=makeCanvas(160),ctx=c.getContext('2d');ctx.font='92px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=active?colors[t.c].dark:'#a0999f';ctx.fillText(typeId+1,80,83);glyphs.set(id,c);return c}
function drawGem(ctx,s,placed){ctx.save();ctx.translate(s.x,s.y);ctx.rotate(s.angle*Math.PI/180);const ratio=(SPRITE_SIZE+PAD*2)/SPRITE_SIZE;ctx.drawImage(sprites.get(`${s.shape}-${s.c}`)[placed?'gem':s.type===selected?'socketActive':'socket'],-s.w*ratio/2,-s.h*ratio/2,s.w*ratio,s.h*ratio);ctx.restore()}
function drawNumber(ctx,s,active=false){const font=Math.min(16,Math.max(3.4,s.w*.31)),size=font*160/92;ctx.drawImage(glyph(s.type,active),s.x-size/2,s.y-size/2,size,size)}
function bounds(s){const a=s.angle*Math.PI/180,r=(SPRITE_SIZE+PAD*2)/SPRITE_SIZE;const w=(Math.abs(s.w*Math.cos(a))+Math.abs(s.h*Math.sin(a)))*r/2+2,h=(Math.abs(s.w*Math.sin(a))+Math.abs(s.h*Math.cos(a)))*r/2+2;return{x:s.x-w,y:s.y-h,w:w*2,h:h*2}}
function cellsIn(b){const cells=[];for(let x=Math.floor(b.x/CELL);x<=Math.floor((b.x+b.w)/CELL);x++)for(let y=Math.floor(b.y/CELL);y<=Math.floor((b.y+b.h)/CELL);y++)cells.push(x+','+y);return cells}
function neighbors(b){const ids=new Set();for(const cell of cellsIn(b))for(const id of index.get(cell)||[])ids.add(id);return [...ids].sort((a,b)=>a-b)}
function repaintScene(){const ctx=slotsLayer.getContext('2d');ctx.clearRect(0,0,WORLD,WORLD);items.forEach((s,i)=>{drawGem(ctx,s,filled.has(i));if(!filled.has(i))drawNumber(ctx,s,s.type===selected)});sceneDirty=false}
function rebuildLayers(){
  if(slotsLayer)slotsLayer.width=0;slotsLayer=makeCanvas(WORLD*CACHE_SCALE);index=new Map();slotsLayer.getContext('2d').scale(CACHE_SCALE,CACHE_SCALE);
  items.forEach((s,i)=>{for(const cell of cellsIn(bounds(s))){if(!index.has(cell))index.set(cell,[]);index.get(cell).push(i)}});repaintScene();
}
function repaintGem(id){const ctx=slotsLayer.getContext('2d'),b=bounds(items[id]);ctx.save();ctx.beginPath();ctx.rect(b.x,b.y,b.w,b.h);ctx.clip();ctx.clearRect(b.x,b.y,b.w,b.h);for(const i of neighbors(b)){const s=items[i];drawGem(ctx,s,filled.has(i));if(!filled.has(i))drawNumber(ctx,s,s.type===selected)}ctx.restore()}
function cameraChanged(){cameraMoving=true;clearTimeout(cameraTimer);cameraTimer=setTimeout(()=>{cameraMoving=false;requestDraw()},100);requestDraw()}
function resize(){if(document.querySelector('.studio').hidden)return;const r=viewport.getBoundingClientRect(),oldFit=fit;width=r.width;height=r.height;fit=Math.min(width,height)/660;if(oldFit>0){pan.x*=fit/oldFit;pan.y*=fit/oldFit;}dpr=Math.min(2,window.devicePixelRatio||1);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);requestDraw()}
function visibleIds(){const halfW=width/(fit*zoom*2),halfH=height/(fit*zoom*2);return neighbors({x:400-pan.x/(fit*zoom)-halfW,y:400-pan.y/(fit*zoom)-halfH,w:halfW*2,h:halfH*2})}
function toWorld(point){const rect=canvas.getBoundingClientRect();return{x:400+(point.x-rect.left-width/2-pan.x)/(fit*zoom),y:400+(point.y-rect.top-height/2-pan.y)/(fit*zoom)}}
function hit(point){const r=canvas.getBoundingClientRect();if(point.x<r.left||point.x>r.right||point.y<r.top||point.y>r.bottom)return -1;const p=toWorld(point),ids=index.get(Math.floor(p.x/CELL)+','+Math.floor(p.y/CELL))||[];for(const id of ids){if(filled.has(id))continue;const s=items[id],a=s.angle*Math.PI/180,dx=p.x-s.x,dy=p.y-s.y;const x=(dx*Math.cos(a)+dy*Math.sin(a))/s.w,y=(-dx*Math.sin(a)+dy*Math.cos(a))/s.h;if(Math.abs(x)>.5||Math.abs(y)>.5)continue;if(hitContext.isPointInPath(sprites.get(`${s.shape}-${s.c}`).path,x,y))return id}return -1}
function chime(){if(!sound)return;try{audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();audioCtx.resume();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.frequency.value=650+selected*120;g.gain.setValueAtTime(.04,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+.15);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+.16)}catch{}}
function place(id){if(id<0||filled.has(id))return;const s=items[id];if(s.type!==selected){if(mode==='tap')notify(`这里需要 ${s.type+1} 号${typeName(s.type)}`);return}filled.add(id);if(id===focusId)focusId=-1;activeStroke.push(id);done[s.type]++;if(filled.size===items.length)pendingCache=true;repaintGem(id);uiDirty=true;deferSave();chime();if(!matchMedia('(prefers-reduced-motion: reduce)').matches){sparks.push({x:s.x,y:s.y,start:performance.now()});if(sparks.length>8)sparks.shift();}}
function commitStroke(){if(activeStroke.length){history.push(activeStroke);activeStroke=[];uiDirty=true;}}
function finishStroke(){strokeEnd=false;commitStroke();flushSave();if(done[selected]===totals[selected]&&filled.size<items.length)selectType(items.find((s,i)=>!filled.has(i)).type);uiDirty=true;}
function processPoints(){const queue=points;points=[];for(const p of queue)place(hit(p))}
function requestDraw(){if(!frame)frame=requestAnimationFrame(draw)}
function draw(now){
  frame=0;if(!items.length||document.querySelector('.studio').hidden)return;
  processPoints();
  if(strokeEnd)finishStroke();
  if(sceneDirty)repaintScene();
  if(uiDirty){updateUI();uiDirty=false}
  context.setTransform(dpr,0,0,dpr,0,0);context.fillStyle='#fff';context.fillRect(0,0,width,height);context.translate(width/2+pan.x,height/2+pan.y);context.scale(fit*zoom,fit*zoom);context.translate(-400,-400);
  const visible=visibleIds();
  if(zoom<=1.8||cameraMoving){context.drawImage(slotsLayer,0,0,WORLD,WORLD)}
  else{for(const i of visible){const s=items[i];drawGem(context,s,filled.has(i));if(!filled.has(i))drawNumber(context,s,s.type===selected)}}
  if(focusId>=0&&!filled.has(focusId)){
    const s=items[focusId],outline=new Path2D();outline.addPath(sprites.get(`${s.shape}-${s.c}`).path,new DOMMatrix().translate(s.x,s.y).rotate(s.angle).scale(s.w*1.15,s.h*1.15));
    context.save();context.strokeStyle='#fff';context.lineWidth=4/(fit*zoom);context.stroke(outline);context.strokeStyle='#bf7194';context.lineWidth=1.6/(fit*zoom);context.stroke(outline);context.restore();
  }
  sparks=sparks.filter(s=>now-s.start<380);for(const s of sparks){const t=Math.max(0,(now-s.start)/380);context.save();context.translate(s.x,s.y);context.globalAlpha=1-t;context.strokeStyle='#d7b475';context.lineWidth=1/(fit*zoom);context.beginPath();context.arc(0,0,(6+t*12)/(fit*zoom),0,Math.PI*2);context.stroke();context.fillStyle='#fff';context.shadowColor='#d3b787';context.shadowBlur=3;const r=9*(1-t)/(fit*zoom);context.beginPath();context.moveTo(0,-r);context.lineTo(r/4,-r/4);context.lineTo(r,0);context.lineTo(r/4,r/4);context.lineTo(0,r);context.lineTo(-r/4,r/4);context.lineTo(-r,0);context.lineTo(-r/4,-r/4);context.closePath();context.fill();context.restore()}
  if(sparks.length)requestDraw();
  if(filled.size===items.length&&pendingCache){pendingCache=false;releasePointers();$('complete').hidden=false}
}
function scrollSelected(){
  const host=$('palette'),button=host.querySelector(`[data-type="${selected}"]`);if(!button)return;
  const outer=host.getBoundingClientRect(),inner=button.getBoundingClientRect();
  if(inner.left<outer.left)host.scrollLeft+=inner.left-outer.left-6;else if(inner.right>outer.right)host.scrollLeft+=inner.right-outer.right+6;
  if(inner.top<outer.top)host.scrollTop+=inner.top-outer.top-6;else if(inner.bottom>outer.bottom)host.scrollTop+=inner.bottom-outer.bottom+6;
}
function selectType(id){selected=id;focusId=-1;sceneDirty=true;uiDirty=true;requestDraw()}
function updateUI(){
  const pct=Math.round(filled.size/items.length*100);$('percent').textContent=pct+'%';$('count').textContent=`${filled.size} / ${items.length} 颗`;$('progress').style.width=pct+'%';$('undo').disabled=!history.length&&!activeStroke.length;$('zoom').textContent=Math.round(zoom*100)+'%';$('gem-name').textContent=typeName(selected);$('remaining').textContent=done[selected]===totals[selected]?'已完成':`剩余 ${totals[selected]-done[selected]} 颗`;$('find').disabled=filled.size===items.length;canvas.setAttribute('aria-label',`${layouts[current].name}，已贴 ${filled.size} / ${items.length} 颗`);
  $('palette').querySelectorAll('[data-type]').forEach(b=>{const t=Number(b.dataset.type);b.classList.toggle('active',t===selected);b.setAttribute('aria-pressed',t===selected);b.querySelector('span').textContent=done[t]===totals[t]?'✓':t+1;b.querySelector('small').textContent=done[t]===totals[t]?'完成':`余 ${totals[t]-done[t]}`;b.title=`${t+1}号 ${typeName(t)} · 剩余 ${totals[t]-done[t]} 颗`});
  if($('palette').dataset.selected!==String(selected)){scrollSelected();$('palette').dataset.selected=String(selected)}
}
function palette(){
  $('palette').innerHTML=types.map((t,i)=>`<button class="gem-choice" data-type="${i}" data-key="${t.key}" aria-label="${i+1}号 ${typeName(i)}"><canvas width="112" height="112"></canvas><span>${i+1}</span><small class="gem-left"></small></button>`).join('');delete $('palette').dataset.selected;
  $('palette-help').hidden=types.length<=6;$('palette-help').textContent=`${types.length} 种宝石 · 滑动选择`;
  $('palette').querySelectorAll('[data-type]').forEach(b=>{const i=Number(b.dataset.type),t=types[i],ctx=b.querySelector('canvas').getContext('2d'),ratio=data.gems[t.key].aspect;drawGem(ctx,{x:56,y:55,w:68*ratio,h:68,angle:0,shape:t.shape,c:t.c,type:i},true)});
}
function setMode(next){mode=next;document.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('active',b.dataset.mode===mode);b.setAttribute('aria-pressed',b.dataset.mode===mode)});$('hint').textContent=mode==='pan'?'拖动画布移动 · 双指缩放':mode==='paint'?'划过相同编号连续贴放 · 双指缩放':'点击对应编号 · 长按空槽选宝石';viewport.classList.toggle('panning',mode==='pan')}
function load(i){
  processPoints();flushSave();releasePointers();current=i;types=layouts[i].types;items=layouts[i].items;filled=saved(i);history=[];activeStroke=[];sparks=[];pendingCache=false;focusId=-1;strokeEnd=false;selected=items.find((s,n)=>!filled.has(n))?.type??0;zoom=1;pan={x:0,y:0};totals=types.map(()=>0);done=types.map(()=>0);items.forEach((s,n)=>{totals[s.type]++;if(filled.has(n))done[s.type]++});
  document.body.className='game-screen';$('selection').hidden=true;document.querySelector('.studio').hidden=false;$('complete').hidden=true;$('title').textContent=layouts[i].name;setMode('tap');rebuildLayers();palette();updateUI();resize();$('back').focus({preventScroll:true});
}
function renderGallery(){
  $('gallery').innerHTML=layouts.map((t,i)=>{const count=saved(i).size;return `<button class="art-card" data-art="${i}" aria-label="选择${t.name}"><div class="art-frame"><canvas width="500" height="500" aria-hidden="true"></canvas></div><span><strong>${t.name}</strong><small>${t.tag} · ${t.items.length} 颗</small><em>${count?`已完成 ${Math.round(count/t.items.length*100)}%`:'开始贴画'}</em></span><span class="arrow">↗</span></button>`}).join('');
  $('gallery').querySelectorAll('[data-art]').forEach(b=>{const ctx=b.querySelector('canvas').getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,500,500);ctx.scale(500/660,500/660);ctx.translate(-70,-70);for(const s of layouts[Number(b.dataset.art)].items)drawGem(ctx,s,true)});
}
function cancelHold(){clearTimeout(holdTimer);holdTimer=0}
function releasePointers(){cancelHold();for(const id of pointers.keys())if(viewport.hasPointerCapture(id))viewport.releasePointerCapture(id);pointers.clear();last=null;pinch=null;touchStart=null;touchMoved=false;}
function pair(){const [a,b]=[...pointers.values()];return{distance:Math.hypot(a.x-b.x,a.y-b.y),mid:{x:(a.x+b.x)/2,y:(a.y+b.y)/2}}}
function queuePoint(p){points.push(p);requestDraw()}
viewport.addEventListener('pointerdown',e=>{if(e.target.closest('button')||!$('complete').hidden||e.button>0)return;if(!pointers.size){processPoints();if(strokeEnd||activeStroke.length)finishStroke();}pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});viewport.setPointerCapture(e.pointerId);if(pointers.size===2){cancelHold();points=[];touchMoved=true;pinch=pair();last=null;return}if(pointers.size>2)return;last={x:e.clientX,y:e.clientY};touchStart={...last};touchMoved=false;holdPicked=false;cancelHold();if(e.pointerType==='touch'&&mode==='tap'){
    const id=hit(last);if(id>=0)holdTimer=setTimeout(()=>{if(pointers.size===1&&!touchMoved&&!pinch){selectType(items[id].type);focusId=id;holdPicked=true;notify(`已选择 ${items[id].type+1}号 ${typeName(items[id].type)}`)}},500);
  }if(e.pointerType!=='touch'&&mode!=='pan')queuePoint(last)});
viewport.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId))return;const p={x:e.clientX,y:e.clientY};pointers.set(e.pointerId,p);if(touchStart&&Math.hypot(p.x-touchStart.x,p.y-touchStart.y)>8){touchMoved=true;cancelHold();}
  if(pointers.size===2){const next=pair();if(pinch&&pinch.distance>0){const r=viewport.getBoundingClientRect(),old=zoom;zoom=Math.max(.7,Math.min(8,zoom*next.distance/pinch.distance));const ratio=zoom/old;pan.x=(pan.x-(pinch.mid.x-r.left-width/2))*ratio+(next.mid.x-r.left-width/2);pan.y=(pan.y-(pinch.mid.y-r.top-height/2))*ratio+(next.mid.y-r.top-height/2);uiDirty=true;cameraChanged()}pinch=next;return}
  if(!last||pinch)return;
  if(mode==='pan'){pan.x+=p.x-last.x;pan.y+=p.y-last.y;cameraChanged()}
  else if(mode==='paint'){const dx=p.x-last.x,dy=p.y-last.y,n=Math.max(1,Math.ceil(Math.hypot(dx,dy)/2));for(let i=0;i<=n;i++)points.push({x:last.x+dx*i/n,y:last.y+dy*i/n});requestDraw()}
  last=p;
});
function pointerEnd(e){if(!pointers.has(e.pointerId))return;cancelHold();if(e.type==='pointerup'&&pointers.size===1&&!pinch&&e.pointerType==='touch'&&mode!=='pan'&&!holdPicked&&(mode==='paint'||!touchMoved))queuePoint({x:e.clientX,y:e.clientY});pointers.delete(e.pointerId);last=null;if(!pointers.size){pinch=null;strokeEnd=true;requestDraw()}}
for(const event of ['pointerup','pointercancel','lostpointercapture'])viewport.addEventListener(event,pointerEnd);
function zoomAt(next,anchor){const rect=viewport.getBoundingClientRect(),x=anchor?anchor.x-rect.left-width/2:0,y=anchor?anchor.y-rect.top-height/2:0,old=zoom;zoom=Math.max(.7,Math.min(8,next));const ratio=zoom/old;pan.x=(pan.x-x)*ratio+x;pan.y=(pan.y-y)*ratio+y;uiDirty=true;cameraChanged()}
function zoomBy(delta){zoomAt(zoom+delta)}
function findNext(){
  if(filled.size===items.length)return;
  if(done[selected]===totals[selected]){selectType(items.find((s,i)=>!filled.has(i)).type);}
  const center={x:400-pan.x/(fit*zoom),y:400-pan.y/(fit*zoom)};
  let best=-1,score=Infinity;
  items.forEach((s,i)=>{if(filled.has(i)||s.type!==selected)return;const value=Math.hypot(s.x-center.x,s.y-center.y)/Math.max(18,Math.min(s.w,s.h));if(value<score){score=value;best=i}});
  focusId=best;const s=items[best];zoom=Math.min(8,Math.max(zoom,1.6,30/(Math.min(s.w,s.h)*fit)));pan={x:-(s.x-400)*fit*zoom,y:-(s.y-400)*fit*zoom};uiDirty=true;cameraChanged();
}
$('find').onclick=findNext;
viewport.addEventListener('wheel',e=>{e.preventDefault();const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?height:1);zoomAt(zoom*Math.exp(-Math.max(-120,Math.min(120,delta))*.002),{x:e.clientX,y:e.clientY})},{passive:false});
$('plus').onclick=()=>zoomBy(.4);$('minus').onclick=()=>zoomBy(-.4);$('fit').onclick=()=>{zoom=1;pan={x:0,y:0};focusId=-1;uiDirty=true;requestDraw()};
$('palette').onclick=e=>{const b=e.target.closest('[data-type]');if(b)selectType(Number(b.dataset.type))};
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
$('gallery').onclick=e=>{const b=e.target.closest('[data-art]');if(b)load(Number(b.dataset.art))};
$('undo').onclick=()=>{processPoints();commitStroke();if(history.length){const ids=history.pop();for(const id of ids){filled.delete(id);done[items[id].type]--;repaintGem(id)}if(selected!==items[ids[0]].type)selectType(items[ids[0]].type);deferSave();uiDirty=true;pendingCache=false;$('complete').hidden=true;requestDraw()}};
$('reset').onclick=()=>{if(confirm('要清空这幅画的进度，重新开始吗？')){points=[];releasePointers();filled.clear();history=[];activeStroke=[];focusId=-1;done.fill(0);sceneDirty=true;deferSave();flushSave();pendingCache=false;$('complete').hidden=true;uiDirty=true;requestDraw()}};
$('continue').onclick=()=>{$('complete').hidden=true};
$('sound').onclick=()=>{sound=!sound;$('sound').textContent=sound?'♫ 音效开':'♫ 音效关';$('sound').setAttribute('aria-pressed',sound);if(sound)chime()};
$('back').onclick=()=>{processPoints();flushSave();releasePointers();sparks=[];document.body.className='selection-screen';$('selection').hidden=false;document.querySelector('.studio').hidden=true;renderGallery();$('gallery').querySelector(`[data-art="${current}"]`).focus({preventScroll:true})};
window.addEventListener('pagehide',()=>{processPoints();flushSave()});document.addEventListener('visibilitychange',()=>{if(document.hidden){processPoints();flushSave()}});new ResizeObserver(resize).observe(viewport);
// Read-only diagnostics are also useful for browser regression tests.
window.GemGarden={getState:()=>({current,layout:layouts[current]?.id,items:items.map(s=>({...s})),filled:[...filled],types:types.map(t=>({...t})),selected,zoom,focusId,pan:{...pan},renderer:'canvas-cache',pendingPoints:points.length,undoCount:history.length})};
(async()=>{
  try{
    data=window.GEM_GEOMETRY||await fetch('assets/geometry.json').then(r=>{if(!r.ok)throw Error('Geometry unavailable');return r.json()});layouts=data.layouts.map(layout=>{
      const types=[],byKey=new Map();const items=layout.items.map(s=>{const key=`${s.shape}-${s.c}`;if(!byKey.has(key)){byKey.set(key,types.length);types.push({key,c:s.c,shape:s.shape})}return{...s,type:byKey.get(key)}});return{...layout,types,items};
    });
    atlas=new Image();atlas.src=window.GEM_ATLAS_DATA||'assets/gemstones.png';await atlas.decode();prepareSprites();renderGallery();
    $('gallery').setAttribute('aria-busy','false');
  }catch(error){console.error(error);$('gallery').innerHTML='<p class="load-error">素材加载失败，请刷新页面，或确认已下载完整的 frontend 文件夹。</p>';notify('贴画素材加载失败')}
})();
