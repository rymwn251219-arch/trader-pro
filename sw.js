// =========================================================
// Trader Pro Service Worker — v2
// استراتيجية ذكية: Network First للـ HTML، Cache First للباقي
// =========================================================

const CACHE_NAME = 'trader-pro-v3';
const CACHE_FILES = [
  '/trader-pro/',
  '/trader-pro/index.html',
  '/trader-pro/manifest.json',
  '/trader-pro/icon.svg',
  '/trader-pro/android-chrome-192x192.png',
  '/trader-pro/android-chrome-512x512.png',
  '/trader-pro/sw.js'
];

// ============ INSTALL ============
self.addEventListener('install', (event) => {
  console.log('SW: Installing v2...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(CACHE_FILES);
      })
      .then(() => {
        console.log('SW: Files cached successfully');
      })
      .catch(err => {
        console.warn('SW: Cache failed -', err.message);
      })
  );
  // تفعيل SW الجديد مباشرة
  self.skipWaiting();
});

// ============ ACTIVATE ============
self.addEventListener('activate', (event) => {
  console.log('SW: Activating v2...');
  event.waitUntil(
    caches.keys()
      .then(names => {
        // حذف كل النسخ القديمة
        return Promise.all(
          names
            .filter(n => n !== CACHE_NAME)
            .map(n => {
              console.log('SW: Deleting old cache:', n);
              return caches.delete(n);
            })
        );
      })
      .then(() => {
        console.log('SW: Activated successfully');
        // السيطرة على كل الصفحات المفتوحة فوراً
        return self.clients.claim();
      })
  );
});

// ============ FETCH ============
self.addEventListener('fetch', (event) => {
  const req = event.request;
  
  // تجاهل أي طلب غير GET
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // ===== تجاهل النطاقات الخارجية (APIs و CDNs) =====
  const SKIP_DOMAINS = [
    'twelvedata.com',
    'puter.com',
    'jsdelivr.net',
    'tradingview.com',
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'unpkg.com',
    'cdnjs.cloudflare.com'
  ];

  if (SKIP_DOMAINS.some(domain => url.hostname.includes(domain))) {
    return; // المتصفح يتعامل معها مباشرة (بدون Cache)
  }

  // تجاهل أي نطاق ليس موقعنا
  if (url.origin !== self.location.origin) return;

  // ===== اختيار الاستراتيجية حسب نوع الملف =====

  // 1. HTML → Network First (دائماً الأحدث)
  const isHTML = 
    (req.headers.get('accept') && req.headers.get('accept').includes('text/html')) ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('/') ||
    url.pathname === '/trader-pro';

  if (isHTML) {
    event.respondWith(networkFirst(req));
    return;
  }

  // 2. الملفات الثابتة (SVG, PNG, JSON) → Cache First
  event.respondWith(cacheFirst(req));
});

// ============ STRATEGY: Network First ============
async function networkFirst(req) {
  try {
    const res = await fetch(req);
    
    if (res && res.ok) {
      // احفظ النسخة الجديدة في Cache
      const cache = await caches.open(CACHE_NAME);
      cache.put(req, res.clone()).catch(() => {});
    }
    
    return res;
  } catch (err) {
    // فشل الإنترنت → ابحث في Cache
    console.log('SW: Network failed, trying cache for', req.url);
    const cached = await caches.match(req);
    
    if (cached) return cached;
    
    // لم نجد شيئاً → index.html
    const fallback = await caches.match('/trader-pro/index.html');
    if (fallback) return fallback;
    
    // لا يوجد شيء إطلاقاً
    return new Response(
      '<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:50px;background:#0a0f1a;color:#6b9bd1"><h1>⚠️ لا يوجد اتصال</h1><p>افتح الإنترنت ثم أعد المحاولة</p></body></html>',
      { 
        status: 503, 
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      }
    );
  }
}

// ============ STRATEGY: Cache First ============
async function cacheFirst(req) {
  // ابحث في Cache أولاً
  const cached = await caches.match(req);
  if (cached) {
    // حدّث Cache في الخلفية (بدون انتظار)
    fetch(req).then(res => {
      if (res && res.ok) {
        caches.open(CACHE_NAME).then(cache => {
          cache.put(req, res.clone()).catch(() => {});
        });
      }
    }).catch(() => {});
    
    return cached;
  }
  
  // لم نجد → اجلب من الإنترنت
  try {
    const res = await fetch(req);
    
    if (res && res.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(req, res.clone()).catch(() => {});
    }
    
    return res;
  } catch (err) {
    // لا يوجد Cache ولا إنترنت
    return new Response('Offline', { 
      status: 503, 
      statusText: 'Offline' 
    });
  }
}

// ============ MESSAGES ============
// يستقبل رسائل من index.html (تحديث قسري)
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    console.log('SW: Received SKIP_WAITING');
    self.skipWaiting();
  }
  
  if (event.data === 'CLEAR_CACHE') {
    console.log('SW: Clearing cache...');
    caches.keys().then(names => {
      return Promise.all(names.map(n => caches.delete(n)));
    }).then(() => {
      console.log('SW: Cache cleared');
      event.source?.postMessage('CACHE_CLEARED');
    });
  }
});

console.log('SW v2: Ready ✅');
