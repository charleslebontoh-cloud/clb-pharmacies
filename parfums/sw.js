const K="clbp-v1.1.0";
self.addEventListener("install",e=>{self.skipWaiting();e.waitUntil(caches.open(K).then(c=>c.addAll(["./","index.html","manifest.json","icon-192.png","photos/accueil.jpg"]).catch(()=>{})));});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==K).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener("fetch",e=>{const u=new URL(e.request.url);if(e.request.method!=="GET"||u.origin!==location.origin)return;
 e.respondWith(fetch(e.request,{cache:"no-store"}).then(r=>{if(r.ok){const c=r.clone();caches.open(K).then(x=>x.put(e.request,c));}return r;}).catch(()=>caches.match(e.request)));});
