const CACHE = 'tripcopilot-v1-readonly';
const API_PREFIX = '/api/v1/trips/';
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(c => c.addAll(['/','/manifest.webmanifest'])).then(() => self.skipWaiting())); });
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;
  if (!isSameOrigin) return;
  const isTripApi = url.pathname.startsWith(API_PREFIX);
  const isNavigation = req.mode === 'navigate';
  if (!isTripApi && !isNavigation) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    try {
      const response = await fetch(req);
      if (response.ok) {
        cache.put(req, response.clone());
        if (isNavigation) cache.put(new Request(url.pathname + url.search), response.clone());
      }
      return response;
    } catch {
      const cached = await cache.match(req) || await cache.match(url.pathname + url.search) || await cache.match('/');
      if (cached) return cached;
      if (isTripApi) return new Response(JSON.stringify({ error:{ code:'OFFLINE', message:'Cached trip data is unavailable offline.' } }), { status:503, headers:{'content-type':'application/json'} });
      return new Response('<!doctype html><title>Trip Copilot</title><p>Offline: this page has not been cached yet.</p>', { status:503, headers:{'content-type':'text/html; charset=utf-8'} });
    }
  }));
});
