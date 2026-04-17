/* Cross-Origin Isolation service worker.
 * Injects COOP + COEP headers so SharedArrayBuffer (WASM threads) is available
 * on hosts that cannot set HTTP headers directly (e.g. GitHub Pages).
 * Based on the technique from https://web.dev/cross-origin-isolation-guide/
 */
if (typeof window === 'undefined') {
  // ── service worker side ──────────────────────────────────────────────────────
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

  self.addEventListener('fetch', e => {
    if (e.request.cache === 'only-if-cached' && e.request.mode !== 'same-origin') return;
    e.respondWith(
      fetch(e.request).then(r => {
        if (!r || r.status === 0) return r;
        const h = new Headers(r.headers);
        h.set('Cross-Origin-Opener-Policy', 'same-origin');
        h.set('Cross-Origin-Embedder-Policy', 'credentialless');
        return new Response(r.body, { status: r.status, statusText: r.statusText, headers: h });
      })
    );
  });
} else {
  // ── page side ────────────────────────────────────────────────────────────────
  (async () => {
    if (window.crossOriginIsolated) return;
    if (!window.isSecureContext) return;
    if (!('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker
      .register(document.currentScript.src)
      .catch(() => null);
    if (!reg) return;
    await navigator.serviceWorker.ready;
    if (reg.active && !navigator.serviceWorker.controller) location.reload();
  })();
}
