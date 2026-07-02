/** Prefetch meta-shop shell before React loads — critical for Instagram / slow networks. */
(function () {
  try {
    var m = location.search.match(/[?&]shop=([^&]+)/);
    if (!m) return;
    var slug = decodeURIComponent(m[1]).replace(/\+/g, ' ').trim();
    if (!slug) return;

    document.documentElement.classList.add('shop-boot-pending');

    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 9000) : null;

    fetch('/api/fb?col=metaShops&slug=' + encodeURIComponent(slug), {
      signal: ctrl ? ctrl.signal : undefined,
      credentials: 'same-origin',
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (shop) {
        if (shop && shop.id && shop.slug) {
          sessionStorage.setItem('ms_boot_' + slug, JSON.stringify({ shop: shop, ts: Date.now() }));
        }
      })
      .catch(function () {})
      .finally(function () {
        if (timer) clearTimeout(timer);
        document.documentElement.classList.remove('shop-boot-pending');
      });
  } catch (_) {}
})();
