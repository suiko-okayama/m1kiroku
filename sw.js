// Service Worker：アプリのファイルをiPhoneの中に取っておき、通信なしでも起動できるようにする係。
// ★アプリを更新して公開するときは、下の VERSION の数字を1つ上げる（v1 → v2）。
//   すると次に開いたとき新しいファイルを取り込み、その次の起動から新しい版になる。
//   記録データは別の場所（IndexedDB）にあるので、更新しても消えない。
const VERSION = 'v1';
const CACHE = `netacho-${VERSION}`;

const FILES = [
  './',
  'index.html',
  'manifest.json',
  'css/style.css',
  'js/app.js',
  'js/backup.js',
  'js/db.js',
  'js/icons.js',
  'js/rounds.js',
  'js/router.js',
  'js/search.js',
  'js/stats.js',
  'js/store.js',
  'js/testdata.js',
  'js/ui.js',
  'js/views/analysis.js',
  'js/views/detail.js',
  'js/views/entry.js',
  'js/views/list.js',
  'js/views/pending.js',
  'js/views/settings.js',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('netacho-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// 取っておいたファイルを先に使う（だから一瞬で開く）。無いものだけ通信で取りに行く
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    event.respondWith(caches.match('index.html', { cacheName: CACHE }).then(r => r || fetch(req)));
    return;
  }
  event.respondWith(caches.match(req, { cacheName: CACHE, ignoreSearch: true }).then(r => r || fetch(req)));
});
