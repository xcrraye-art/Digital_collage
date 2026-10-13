// Browser regression checks. Requires Playwright and Chromium in the test environment.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

(async () => {
  const server = spawn('python3', ['-u', '-m', 'http.server', '0', '--bind', '127.0.0.1'], {
    cwd: path.resolve(__dirname, '..'), stdio: ['ignore', 'pipe', 'pipe']
  });
  let browser;
  try {
    const port = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Test HTTP server startup timed out')), 10000);
      server.stdout.on('data', data => {const match = String(data).match(/port (\d+)/);if (match) {clearTimeout(timer);resolve(match[1]);}});
      server.on('error', reject);
      server.on('exit', code => {clearTimeout(timer);reject(new Error('Server exited: '+code));});
    });
    const origin = `http://127.0.0.1:${port}`;
    browser = await chromium.launch({executablePath:process.env.GEM_BROWSER_BIN || '/usr/bin/chromium',args:['--no-sandbox']});
    const page = await browser.newPage({viewport:{width:1440,height:1050}});
    const errors=[]; page.on('pageerror', e => errors.push(e.message));
    await page.goto(origin);
    await page.waitForURL('**/frontend/');
    assert.equal(await page.locator('.studio').isVisible(),false);
    assert.equal(await page.locator('.art-card').count(),4);
    const asset = await page.request.get(origin+'/frontend/assets/gemstones.png');
    assert.equal(asset.status(),200);
    assert.ok((await asset.body()).length>100000, 'Detailed atlas exists');
    await page.locator('[data-art="0"]').click();
    assert.equal(await page.locator('.slot').count(),45);
    assert.equal(await page.locator('#viewport').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 255, 255)');
    // Existing progress is preserved across reload and navigation.
    await page.locator('[data-id="0"]').click();
    assert.equal(await page.locator('.placed').count(),1);
    await page.locator('[data-id="16"]').click();
    assert.equal(await page.locator('.placed').count(),1, 'Wrong color is rejected');
    await page.locator('#undo').click();assert.equal(await page.locator('.placed').count(),0);
    await page.locator('[data-id="0"]').click();
    await page.reload();assert.equal(await page.locator('.studio').isVisible(),false);
    await page.locator('[data-art="0"]').click();assert.equal(await page.locator('.placed').count(),1);
    await page.locator('[data-mode="paint"]').click();
    const a=await page.locator('[data-id="1"]').boundingBox(),c=await page.locator('[data-id="2"]').boundingBox();
    await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();
    await page.mouse.move(c.x+c.width/2,c.y+c.height/2,{steps:20});await page.mouse.up();
    assert.ok(await page.locator('.placed').count()>=3,'Continuous painting places multiple');
    for(let color=0;color<4;color++){
      await page.locator(`[data-color="${color}"]`).click();
      const ids=await page.locator('.slot:not(.placed)').evaluateAll((els,c)=>els.filter(el=>el.querySelector('text').textContent===String(c+1)).map(el=>el.dataset.id),color);
      for(const id of ids)await page.locator(`[data-id="${id}"]`).click();
    }
    assert.equal(await page.locator('.placed').count(),45);
    assert.equal(await page.locator('#percent').textContent(),'100%');assert.equal(await page.locator('#complete').isVisible(),true);
    await page.locator('#continue').click();
    await page.locator('#back').click();assert.match(await page.locator('[data-art="0"] em').textContent(),/100%/);
    await page.locator('[data-art="3"]').click();assert.equal(await page.locator('.slot').count(),650);
    assert.ok(await page.locator('.slot').evaluateAll(els=>els.some(e=>e.querySelector('.outline')?.getAttribute('d').includes('C-33 -65'))),'Heart-shaped slots exist');
    await page.locator('#plus').click();assert.equal(await page.locator('#zoom').textContent(),'140%');
    await page.locator('[data-mode="pan"]').click();await page.mouse.move(700,550);await page.mouse.down();await page.mouse.move(750,580);await page.mouse.up();
    assert.match(await page.locator('#canvas').getAttribute('style'),/translate\(50px, 30px\)/);
    await page.locator('#fit').click();assert.equal(await page.locator('#zoom').textContent(),'100%');
    // The standalone version must work without an external texture request.
    let external=[];await page.route('**/assets/**',r=>{external.push(r.request().url());r.abort();});
    await page.goto(origin+'/frontend/gem-garden.html');await page.locator('[data-art="1"]').click();
    assert.equal(await page.locator('.slot').count(),67);assert.equal(external.length,0);
    assert.ok(await page.evaluate(()=>window.GEM_ATLAS_DATA.startsWith('data:image/png;base64,')));
    await page.unroute('**/assets/**');
    // Real browser touch input: tapping, pinch zoom and pinch without accidental placements.
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    const mobile=await context.newPage();mobile.on('pageerror',e=>errors.push(e.message));
    await mobile.goto(origin+'/frontend/');await mobile.locator('[data-art="0"]').tap();
    const gem=await mobile.locator('[data-id="0"]').boundingBox();await mobile.touchscreen.tap(gem.x+gem.width/2,gem.y+gem.height/2);
    assert.equal(await mobile.locator('.placed').count(),1,'Touch tap places a gem');
    const client=await context.newCDPSession(mobile);
    const points=(x1,x2)=>[{x:x1,y:490,id:1},{x:x2,y:490,id:2}];
    await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(165,225)});
    await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(110,280)});
    await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert.ok(parseInt(await mobile.locator('#zoom').textContent())>200,'Two-finger pinch zooms');
    assert.equal(await mobile.locator('.placed').count(),1,'Pinch does not place gems');
    await mobile.locator('#fit').tap();await mobile.locator('#back').tap();await mobile.locator('[data-art="3"]').tap();
    assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile does not overflow horizontally');
    for(const id of ['back','plus','minus','fit'])assert.equal(await mobile.locator('#'+id).isVisible(),true);
    assert.deepEqual(errors,[]);
    console.log('PASS: textures, selection, original progress, wrong-color rejection, undo, drag paint, completion, 650-gem birds, heart slots, pan/zoom, standalone, touch tap/pinch, mobile layout, no JS errors.');
  } finally {if(browser)await browser.close();server.kill();}
})().catch(error=>{console.error(error);process.exitCode=1;});
