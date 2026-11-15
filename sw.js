/* Service worker do Painel de Estudos
   Para forçar a atualização do app em todos os aparelhos, mude o número da VERSAO. */
const VERSAO = 'v1';
const CACHE = 'painel-estudos-' + VERSAO;

const ARQUIVOS = [
  './',
  './index.html',
  './css/base.css?v=1',
  './css/grade.css?v=1',
  './css/planilha.css?v=1',
  './css/graficos.css?v=1',
  './css/aparencia.css?v=1',
  './js/tema.js?v=1',
  './js/pomodoro.js?v=1',
  './js/planilha.js?v=1',
  './js/grade.js?v=1',
  './js/graficos.js?v=1',
  './js/aparencia.js?v=1'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      // um arquivo que falhe não impede a instalação dos outros
      .then((c) => Promise.all(ARQUIVOS.map((u) => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k.startsWith('painel-estudos-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return; // envios (POST) para a planilha passam direto

  const url = new URL(req.url);
  const mesmaOrigem = url.origin === location.origin;
  const fonte = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!mesmaOrigem && !fonte) return; // Apps Script / Google Sheets: nunca em cache

  // Páginas: tenta a rede primeiro (pega atualizações), cai no cache se estiver offline
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((r) => { const c = r.clone(); caches.open(CACHE).then((k) => k.put('./index.html', c)); return r; })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // Demais arquivos: responde do cache e atualiza em segundo plano
  e.respondWith(
    caches.match(req).then((emCache) => {
      const rede = fetch(req).then((r) => {
        if (r && (r.ok || r.type === 'opaque')) { const c = r.clone(); caches.open(CACHE).then((k) => k.put(req, c)); }
        return r;
      }).catch(() => emCache);
      return emCache || rede;
    })
  );
});