// DrawBound Service Worker
const CACHE_NAME = "drawbound-v1";
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./app.js",
  "./style.css",
  "./manifest.json",
  "./logo_DrawBound.svg"
];

// Install: cache static assets
self.addEventListener("install", function(event){
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      return cache.addAll(STATIC_ASSETS).catch(function(err){
        console.warn("[SW] Cache pre-load partial:", err);
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(key){
        if(key !== CACHE_NAME) return caches.delete(key);
      }));
    })
  );
  self.clients.claim();
});

// Fetch: network-first for HTML/JS, cache-first for assets
self.addEventListener("fetch", function(event){
  const req = event.request;
  if(req.method !== "GET") return;
  
  const url = new URL(req.url);
  
  // Don't intercept Supabase API calls or external scripts
  if(url.hostname.indexOf("supabase") >= 0) return;
  if(url.hostname.indexOf("paypal") >= 0) return;
  if(url.hostname.indexOf("gstatic") >= 0) return;
  if(url.hostname.indexOf("googleapis") >= 0) return;
  
  // For HTML and JS: network first, fallback to cache
  if(req.destination === "document" || req.destination === "script"){
    event.respondWith(
      fetch(req).then(function(res){
        if(res && res.status === 200){
          const clone = res.clone();
          caches.open(CACHE_NAME).then(function(cache){ cache.put(req, clone); });
        }
        return res;
      }).catch(function(){
        return caches.match(req);
      })
    );
    return;
  }
  
  // For other assets: cache first
  event.respondWith(
    caches.match(req).then(function(cached){
      if(cached) return cached;
      return fetch(req).then(function(res){
        if(res && res.status === 200 && res.type === "basic"){
          const clone = res.clone();
          caches.open(CACHE_NAME).then(function(cache){ cache.put(req, clone); });
        }
        return res;
      });
    })
  );
});

// Push notifications
self.addEventListener("push", function(event){
  if(!event.data) return;
  let data;
  try{ data = event.data.json(); }catch(e){ data = { title: "DrawBound", body: event.data.text() }; }
  const title = data.title || "DrawBound";
  const options = {
    body: data.body || "",
    icon: "./logo_DrawBound.svg",
    badge: "./logo_DrawBound.svg",
    data: data.url || "/"
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function(event){
  event.notification.close();
  const url = event.notification.data || "/";
  event.waitUntil(clients.openWindow(url));
});
