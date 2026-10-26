const CACHE_NAME = 'italy-flight-monitor-v7';
const ASSETS = ['./', './index.html', './styles.css', './app.js', './icon.svg', './manifest.json'];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(k => {
          if (k !== CACHE_NAME) {
            console.log('[SW] 清理旧版本缓存:', k);
            return caches.delete(k);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 采用网络优先策略 (Network First)，确保每次刷新与访问都获取最新全网运价
self.addEventListener('fetch', event => {
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then(res => {
        if (res && res.status === 200) {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
