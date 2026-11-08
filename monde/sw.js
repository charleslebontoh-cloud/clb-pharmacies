const K="clbw-v6",A=["./","index.html","data.js","manifest.json","icon-180.png","icon-192.png","icon-512.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(K).then(c=>c.addAll(A)));self.skipWaiting();});
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith("clbw-")&&k!==K).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{const u=new URL(e.request.url);if(u.origin!==location.origin||!u.pathname.includes("/monde/"))return;
 e.respondWith(fetch(e.request,{cache:"no-store"}).then(r=>{const c=r.clone();caches.open(K).then(k=>k.put(e.request.url.split("?")[0],c));return r;}).catch(()=>caches.match(e.request.url.split("?")[0])));});
