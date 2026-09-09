// v3 — network-first so a new GitHub Pages deploy is never stuck behind a stale cache.
// Bumping CACHE below is still good hygiene (keeps storage tidy) but is no longer
// required for correctness: fresh files are served whenever the device is online.
const CACHE='wfw430-v5';
const ASSETS=['./','./index.html','./styles.css','./app.js','./manifest.webmanifest',
  './icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable-512.png',
  './icons/favicon-48.png','./icons/apple-touch-icon.png'];

self.addEventListener('install',e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  const url=new URL(e.request.url);
  if(url.origin!==self.location.origin) return; // don't intercept cross-origin requests

  e.respondWith(
    fetch(e.request)
      .then(res=>{
        const copy=res.clone();
        caches.open(CACHE).then(c=>c.put(e.request,copy));
        return res;
      })
      .catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html')))
  );
});
