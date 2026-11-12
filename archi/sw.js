const C="archea-v1.5.1";
self.addEventListener("install",e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(["./","index.html","manifest.json","icon-192.png","plan.js","batiment.js","view3d.js","tech.js","pdf.js","vendor/three.module.js","vendor/three.core.js"]).catch(()=>{})))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{const u=new URL(e.request.url);if(e.request.method!=="GET"||u.origin!==location.origin)return;
 const fresh=e.request.mode==="navigate"||/\.(html|js|json|css)$/.test(u.pathname)||u.pathname.endsWith("/");
 if(fresh){const nu=new URL(u);nu.searchParams.set("_cb",Date.now());e.respondWith(fetch(nu.toString(),{cache:"no-store"}).then(r=>{if(r.ok&&!u.pathname.includes("/nodata/")){const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp))}return r}).catch(()=>caches.match(e.request,{ignoreSearch:true})));return}
 e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(x=>{const cp=x.clone();caches.open(C).then(c=>c.put(e.request,cp));return x})))});
