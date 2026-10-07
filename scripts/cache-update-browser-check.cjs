/* Reproduce an open tab with old one-hour HTTP caches, then publish a new worker. */
const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const worker=fs.readFileSync(path.join(__dirname,'../Setwerk-Webapp-1.2.0-Projektdateien/dist/sw.js'),'utf8');
const newCache=/const CACHE='([^']+)'/.exec(worker)[1];
const oldWorker="self.addEventListener('install',e=>e.waitUntil(caches.open('setwerk-test-old').then(c=>c.addAll(['/','/app.js']))));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',e=>e.respondWith(fetch(e.request)));";
let version='old';
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');res.setHeader('Cache-Control',url.pathname==='/sw.js'?'no-cache':'max-age=3600');
 if(url.pathname==='/sw.js'){res.setHeader('Content-Type','text/javascript');return res.end(version==='old'?oldWorker:worker);}
 if(url.pathname==='/app.js'){res.setHeader('Content-Type','text/javascript');return res.end('window.fixtureVersion='+JSON.stringify(version)+';document.querySelector("#version").textContent=window.fixtureVersion;');}
 if(url.pathname==='/'||url.pathname==='/index.html'){res.setHeader('Content-Type','text/html');return res.end('<!doctype html><html><body><p id="version"></p><script src="/app.js"></script></body></html>');}
 res.end('fixture-'+version);
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await chromium.launch({headless:true});const context=await browser.newContext(),page=await context.newPage();const origin='http://127.0.0.1:'+server.address().port;
  await page.goto(origin);assert.equal(await page.locator('#version').textContent(),'old');
  await page.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'});await navigator.serviceWorker.ready;localStorage.setItem('setwerk.v1','unchanged-workouts');await caches.open('other-application-cache');});
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await page.reload();assert.equal(await page.locator('#version').textContent(),'old');
  version='new';assert.match(await page.evaluate(()=>fetch('/app.js').then(r=>r.text())),/"old"/);await page.evaluate(async()=>{const registration=await navigator.serviceWorker.getRegistration();await registration.update();});
  await page.waitForFunction(async(name)=>{const registration=await navigator.serviceWorker.getRegistration(),names=await caches.keys();return registration.active?.state==='activated'&&!registration.installing&&!registration.waiting&&names.includes(name)&&!names.includes('setwerk-test-old');},newCache);
  assert.match(await page.evaluate(()=>fetch('/app.js').then(r=>r.text())),/"new"/);
  // A normal reload now gets the new UI without clearing account/workout storage.
  await page.reload();await page.waitForFunction(()=>document.querySelector('#version')?.textContent==='new');assert.equal(await page.locator('#version').textContent(),'new');assert.equal(await page.evaluate(()=>localStorage.getItem('setwerk.v1')),'unchanged-workouts');
  assert.ok((await page.evaluate(()=>caches.keys())).includes('other-application-cache'));
  await page.evaluate(()=>Promise.all([fetch('/__/firebase/init.json'),fetch('/.netlify/private')]));
  const cached=await page.evaluate(async(name)=>{const cache=await caches.open(name);return(await cache.keys()).map(r=>new URL(r.url).pathname);},newCache);
  assert.equal(cached.some(p=>p.startsWith('/__/')||p.startsWith('/.netlify/')),false);
  await context.setOffline(true);await page.reload();await page.waitForFunction(()=>document.querySelector('#version')?.textContent==='new');assert.equal(await page.locator('#version').textContent(),'new');assert.equal(await page.evaluate(()=>localStorage.getItem('setwerk.v1')),'unchanged-workouts');
  console.log(JSON.stringify({cacheUpdateChecks:'passed',openTabUpgrade:true,freshAssets:true,offlineReload:true,workoutsPreserved:true,privateEndpointsExcluded:true}));
 }finally{await browser?.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
