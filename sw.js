// Trader Pro Service Worker
const CACHE_NAME = 'trader-pro-v1';
const URLS = [
  '/trader-pro/',
  '/trader-pro/index.html',
  '/trader-pro/manifest.json'
];

// تثبيت — تخزين الملفات
self.addEventListener('install', (event) => {
  console.log('SW: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(URLS);
    }).catch((err) => {
      console.log('SW: Cache addAll failed:', err);
    })
  );
  self.skipWaiting();
});

// تفعيل — حذف النسخ القديمة
self.addEventListener('activate', (event) => {
  console.log('SW: Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// اعتراض الطلبات
self.addEventListener('fetch', (event) => {
  // تجاهل طلبات APIs الخارجية
  if (event.request.url.includes('twelvedata.com') ||
      event.request.url.includes('puter.com') ||
      event.request.url.includes('chart.js') ||
      event.request.url.includes('tradingview.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).then((fetchResponse) => {
        // تخزين نسخة من الملفات الجديدة
        if (event.request.method === 'GET' &&
            fetchResponse.status === 200 &&
            event.request.url.startsWith(self.location.origin)) {
          const responseClone = fetchResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return fetchResponse;
      });
    }).catch(() => {
      // إذا فشل كل شيء — عرض index.html
      return caches.match('/trader-pro/index.html');
    })
  );
});

console.log('SW: Loaded');
