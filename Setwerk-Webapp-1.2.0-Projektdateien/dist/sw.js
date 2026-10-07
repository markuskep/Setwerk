const CACHE='setwerk-v1.5.1-fresh-assets';
const ASSETS=['./','./index.html','./styles.css','./transfer.js','./core.js','./app.js','./auth.js','./cloud-core.js','./cloud.js','./firebase-service.js','./account-ui.js','./avatar-default.svg','./firebase-store.js','./exercises.js','./exercises-en.js','./i18n.js','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS.map(url=>new Request(url,{cache:'reload'}))).then(()=>self.skipWaiting())));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('setwerk-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin||(new URL(event.request.url).pathname.startsWith('/.netlify/')||new URL(event.request.url).pathname.startsWith('/__/')))return;event.respondWith(fetch(event.request,{cache:'no-cache'}).then(r=>{if(r.ok&&!r.redirected){const copy=r.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));}return r;}).catch(()=>caches.match(event.request).then(r=>r||(event.request.mode==='navigate'?caches.match('./index.html'):Response.error()))));});


