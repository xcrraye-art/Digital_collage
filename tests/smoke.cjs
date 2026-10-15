const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const path=require('node:path');
(async()=>{
 const server=spawn('python3',['-u','-m','http.server','0','--bind','127.0.0.1'],{cwd:path.resolve(__dirname,'..'),stdio:['ignore','pipe','pipe']});let browser;
 try{
  const port=await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Server timeout')),10000);server.stdout.on('data',d=>{const m=String(d).match(/port (\d+)/);if(m){clearTimeout(t);resolve(m[1])}});server.on('error',reject)});
  const origin=`http://127.0.0.1:${port}`;
  browser=await chromium.launch({executablePath:process.env.GEM_BROWSER_BIN||'/usr/bin/chromium',args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1440,height:1050}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const state=p=>p.evaluate(()=>GemGarden.getState());
  async function screen(p,id){const s=await state(p),g=s.items[id],r=await p.locator('#canvas').boundingBox(),f=Math.min(r.width,r.height)/660*s.zoom;return{x:r.x+r.width/2+s.pan.x+(g.x-400)*f,y:r.y+r.height/2+s.pan.y+(g.y-400)*f}}
  async function clickGem(p,id,touch=false){const q=await screen(p,id);if(touch)await p.touchscreen.tap(q.x,q.y);else await p.mouse.click(q.x,q.y);}
  async function waitFilled(p,n){await p.waitForFunction(n=>GemGarden.getState().filled.length===n,n)}
  await page.goto(origin);await page.waitForURL('**/frontend/');await page.locator('[data-art="3"]').waitFor();
  assert.equal(await page.locator('.studio').isVisible(),false);assert.equal(await page.locator('.art-card').count(),4);
  await page.evaluate(()=>localStorage.setItem('gem-garden-0',JSON.stringify([0,16])));
  await page.locator('[data-art="0"]').click();assert.equal((await state(page)).items.length,140);
  assert.equal((await state(page)).renderer,'canvas-cache');assert.equal((await state(page)).filled.length,0,'Old index save is not applied to a different layout');
  assert.equal(await page.locator('#viewport').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 255, 255)');
  await clickGem(page,0);await waitFilled(page,1);
  const wrong=(await state(page)).items.findIndex(s=>s.c!==0);await clickGem(page,wrong);assert.equal((await state(page)).filled.length,1);
  await page.locator('#undo').click();await waitFilled(page,0);await clickGem(page,0);await waitFilled(page,1);
  await page.reload();await page.locator('[data-art="0"]').click();await waitFilled(page,1);
  assert.equal(await page.evaluate(()=>localStorage.getItem('gem-garden-0')),'[0,16]','Legacy save is retained');
  await page.locator('[data-mode="paint"]').click();const a=await screen(page,1),c=await screen(page,2);
  await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(c.x,c.y,{steps:20});await page.mouse.up();
  await page.waitForFunction(()=>GemGarden.getState().filled.length>=3);
  for(let color=0;color<4;color++){
   await page.locator(`[data-color="${color}"]`).click();
   await page.waitForFunction(c=>GemGarden.getState().selected===c,color);
   let s=await state(page);for(let id=0;id<s.items.length;id++)if(s.items[id].c===color&&!s.filled.includes(id))await clickGem(page,id);
  }
  await waitFilled(page,140);assert.equal(await page.locator('#complete').isVisible(),true);assert.equal(await page.locator('#percent').textContent(),'100%');
  await page.locator('#continue').click();await page.locator('#plus').click();assert.equal(await page.locator('#complete').isVisible(),false,'Zoom does not reopen completion');
  await page.locator('#back').click();assert.match(await page.locator('[data-art="0"] em').textContent(),/100%/);
  await page.locator('[data-art="3"]').click();assert.equal((await state(page)).items.length,210);
  assert.ok((await state(page)).items.some(s=>s.shape==='heart'));
  await page.locator('#plus').click();await page.waitForFunction(()=>GemGarden.getState().zoom===1.4);
  await page.locator('[data-mode="pan"]').click();await page.mouse.move(700,550);await page.mouse.down();await page.mouse.move(750,580);await page.mouse.up();assert.equal((await state(page)).pan.x,50);
  // High zoom uses individual cached sprites, preserving hit geometry.
  await page.locator('#fit').click();await page.locator('#plus').click();await page.locator('#plus').click();await page.locator('#plus').click();await page.waitForFunction(()=>GemGarden.getState().zoom>1.8);
  await page.locator('[data-mode="tap"]').click();let high=(await state(page));let central=high.items.findIndex(s=>Math.abs(s.x-400)<65&&Math.abs(s.y-400)<65);await page.locator(`[data-color="${high.items[central].c}"]`).click();await clickGem(page,central);await waitFilled(page,1);
  await page.locator('#fit').click();await page.waitForFunction(()=>GemGarden.getState().zoom===1);
  await page.locator('#back').click();await page.locator('[data-art="2"]').click();assert.equal((await state(page)).items.length,175);await clickGem(page,0);await waitFilled(page,1);
  // Reset clears paint and resets progress without discarding the legacy save.
  page.once('dialog',d=>d.accept());await page.locator('#reset').click();await waitFilled(page,0);
  // Locating a target must move the camera without placing anything.
  await page.locator('#find').click();let located=await state(page);assert.ok(located.focusId>=0);assert.equal(located.filled.length,0);
  const target=await screen(page,located.focusId),box=await page.locator('#canvas').boundingBox();assert.ok(Math.abs(target.x-(box.x+box.width/2))<1&&Math.abs(target.y-(box.y+box.height/2))<1,'Target centered');
  await clickGem(page,located.focusId);await waitFilled(page,1);assert.equal((await state(page)).focusId,-1);assert.match(await page.locator('#remaining').textContent(),/剩余/);
  // Wheel zoom keeps the world point below the mouse stationary.
  await page.locator('#fit').click();await page.waitForFunction(()=>GemGarden.getState().zoom===1);
  const anchor={x:Math.round(box.x+box.width*.7),y:Math.round(box.y+box.height*.3)};
  const world=(q,st)=>({x:400+(q.x-box.x-box.width/2-st.pan.x)/(Math.min(box.width,box.height)/660*st.zoom),y:400+(q.y-box.y-box.height/2-st.pan.y)/(Math.min(box.width,box.height)/660*st.zoom)});
  const before=world(anchor,await state(page));await page.mouse.move(anchor.x,anchor.y);await page.mouse.wheel(0,-120);await page.waitForFunction(()=>GemGarden.getState().zoom>1);const after=world(anchor,await state(page));assert.ok(Math.hypot(before.x-after.x,before.y-after.y)<.01,'Wheel anchor preserved');

  let external=[];await page.route('**/assets/**',r=>{external.push(r.request().url());r.abort()});
  await page.goto(origin+'/frontend/gem-garden.html');await page.locator('[data-art="1"]').click();assert.equal((await state(page)).items.length,103);assert.equal(external.length,0);await clickGem(page,0);await waitFilled(page,1);
  await page.unroute('**/assets/**');
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});const mobile=await ctx.newPage();mobile.on('pageerror',e=>errors.push(e.message));
  await mobile.goto(origin+'/frontend/');await mobile.locator('[data-art="0"]').tap();await clickGem(mobile,0,true);await waitFilled(mobile,1);
  const cdp=await ctx.newCDPSession(mobile),pts=(x,y)=>[{x,y:490,id:1},{x:y,y:490,id:2}];
  const swipeStart=await screen(mobile,1),swipeEnd=await screen(mobile,2);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...swipeStart,id:5}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...swipeEnd,id:5}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.equal((await state(mobile)).filled.length,1,'Sliding in tap mode does not place a gem on release');

  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:pts(165,225)});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:pts(110,280)});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.ok((await state(mobile)).zoom>2);assert.equal((await state(mobile)).filled.length,1,'Pinch does not place gems');
  await mobile.locator('#fit').tap();await mobile.locator('#back').tap();await mobile.locator('[data-art="3"]').tap();assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.equal(await mobile.locator('#canvas').evaluate(c=>c.width),780,'Canvas respects mobile pixel density');
  await mobile.setViewportSize({width:844,height:390});await mobile.waitForTimeout(150);
  assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  for(const id of ['canvas','find','fit','plus','back']){const r=await mobile.locator('#'+id).boundingBox();assert.ok(r.y>=0&&r.y+r.height<=391,`${id} fits landscape viewport`)}
  await mobile.locator('#find').tap();const landscape=await state(mobile);assert.ok(landscape.focusId>=0);await clickGem(mobile,landscape.focusId,true);await waitFilled(mobile,1);

  assert.deepEqual(errors,[]);
  console.log('PASS: target locator, remaining counts, anchored wheel zoom, touch swipe protection; all four layouts, cached renderer, precise hit testing, wrong-color rejection, undo, new/legacy saves, drag paint, completion, pan/zoom, standalone assets, mobile tap/pinch, DPR and no horizontal overflow.');
 }finally{if(browser)await browser.close();server.kill()}
})().catch(e=>{console.error(e);process.exitCode=1});
