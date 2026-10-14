const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../..'),preview=path.join(root,'Setwerk-Musik-Vorschau.html'),screens=path.join(root,'music-screens');
fs.mkdirSync(screens,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
 const errors=[];
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('file://'+preview);await page.locator('.music-current').waitFor();
  assert.equal(await page.locator('.music-track strong').textContent(),'Night Drive');
  await page.locator('[data-music-action=pause]').click();await page.locator('[data-music-action=play]').waitFor();
  await page.locator('[data-music-action=play]').click();await page.locator('[data-music-action=pause]').waitFor();
  await page.locator('[data-music-action=next]').click();await page.waitForFunction(()=>document.querySelector('.music-track strong')?.textContent==='Momentum');
  await page.locator('[data-music-action=previous]').click();await page.waitForFunction(()=>document.querySelector('.music-track strong')?.textContent==='Night Drive');
  await page.locator('[data-music-seek]').evaluate(el=>{el.value='125000';el.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.waitForFunction(()=>document.querySelector('[data-music-position]')?.textContent.startsWith('2:05'));
  await page.locator('[data-music-action=remove-next]').click();await page.waitForFunction(()=>document.querySelector('.music-next-track strong')?.textContent==='Second Wind');
  for(const width of [320,360,390,768]){
   await page.setViewportSize({width,height:844});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   assert.equal(await page.locator('.music-controls').evaluate(el=>el.getBoundingClientRect().right<=innerWidth),true);
   await page.screenshot({path:path.join(screens,'focus-'+width+'.png'),fullPage:true});
  }
  await page.setViewportSize({width:390,height:844});
  await page.locator('[data-action=complete-set]').click();await page.locator('.rest-overlay:not(.is-minimized) #setwerk-music').waitFor();
  assert.equal(await page.locator('[data-action=minimize-rest]').evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight}),true);
  await page.screenshot({path:path.join(screens,'rest-390.png')});
  await page.locator('[data-action=minimize-rest]').click();await page.locator('.focus-shell > #setwerk-music').waitFor();
  await page.locator('[data-action=skip-rest]').click();await page.locator('.rest-overlay').waitFor({state:'detached'});
  await page.locator('#preview-scenario').selectOption('basic');await page.locator('[data-music-action=remove-next]').waitFor({state:'detached'});
  await page.locator('#preview-scenario').selectOption('access');await page.locator('[data-music-action=connect]').waitFor();
  await page.locator('[data-music-action=connect]').click();await page.locator('.music-current').waitFor();
  await page.locator('#preview-scenario').selectOption('empty');await page.locator('.music-current').waitFor({state:'detached'});
  await page.locator('#preview-scenario').selectOption('full');await page.locator('.music-current').waitFor();
  assert.deepEqual(errors,[]);console.log('Music preview: mobile widths, native commands, queue, setup, empty state and rest controls passed.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
