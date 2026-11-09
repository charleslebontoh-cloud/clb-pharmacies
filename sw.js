const K="clb-v13.12.0",A=["./","index.html","manifest.json","icon-180.png","icon-192.png","icon-512.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(K).then(c=>c.addAll(A)));self.skipWaiting();});
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith("clb-v")&&k!==K).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{const u=new URL(e.request.url);if(u.origin!==location.origin)return;
 e.respondWith(fetch(e.request,{cache:"no-store"}).then(r=>{const c=r.clone();caches.open(K).then(k=>k.put(e.request.url.split("?")[0],c));return r;}).catch(()=>caches.match(e.request.url.split("?")[0])));});
self.addEventListener("notificationclick",e=>{e.notification.close();e.waitUntil(self.clients.matchAll({type:"window"}).then(cs=>{for(const c of cs){if("focus"in c){c.navigate&&c.navigate("./#eau");return c.focus();}}return self.clients.openWindow("./#eau");}));});