// Service worker: сайт открывается без интернета и принимает push-напоминания.
const CACHE = 'planner-v2';
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './css/theme.css', './css/layout.css', './css/app.css', './css/week-views.css', './css/images.css', './css/habits.css', './css/budget.css',
  './icons/icon-192.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Свои файлы и библиотеки: сначала сеть (всегда свежая версия), без сети — из кэша.
// Запросы к базе Supabase не трогаем: ими занимается офлайн-хранилище сайта.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  const own = url.origin === self.location.origin && !url.pathname.includes('/dev/');
  const lib = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com', 'images.unsplash.com'].includes(url.hostname);
  if (!own && !lib) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok || res.type === 'opaque') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: own }).then((r) => r || (e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error()))),
  );
});

// Страница присылает список уже загруженных файлов — сохраняем, чтобы следующий запуск работал без сети.
self.addEventListener('message', (e) => {
  if (e.data?.type !== 'cache' || !Array.isArray(e.data.urls)) return;
  const allowed = e.data.urls.filter((u) => {
    try {
      const url = new URL(u);
      return (url.origin === self.location.origin && !url.pathname.includes('/dev/'))
        || ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname);
    } catch { return false; }
  });
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(allowed.map((u) => c.add(u).catch(() => {})))));
});

self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { data = { title: e.data?.text() }; }
  e.waitUntil(self.registration.showNotification(data.title || 'Мой планер', {
    body: data.body || '',
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    tag: data.tag,
    data: { url: data.url || './#/today' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = new URL(e.notification.data?.url || './#/today', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const open = list.find((c) => c.url.startsWith(self.registration.scope));
    if (open) { open.navigate(target).catch(() => {}); return open.focus(); }
    return self.clients.openWindow(target);
  }));
});
