/** Proxy product images (Temu kwcdn etc.) with Referer — fixes blocked/slow mobile loads. */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).end();
    return;
  }

  const raw = req.query.u;
  if (!raw || typeof raw !== 'string') {
    res.status(400).end();
    return;
  }

  let target;
  try {
    target = new URL(raw);
    if (target.protocol !== 'https:') {
      res.status(400).end();
      return;
    }
    const host = target.hostname.toLowerCase();
    const allowed =
      host.includes('kwcdn.com')
      || host.endsWith('cloudfront.net')
      || host.includes('firebasestorage.googleapis.com')
      || host.endsWith('.firebasestorage.app')
      || /\.(jpg|jpeg|png|webp|gif)$/i.test(target.pathname);
    if (!allowed) {
      res.status(403).end();
      return;
    }
  } catch {
    res.status(400).end();
    return;
  }

  try {
    const upstream = await fetch(target.toString(), {
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (compatible; MetaShopImageProxy/1.0)',
        Referer: 'https://www.temu.com/',
      },
      redirect: 'follow',
    });

    if (!upstream.ok) {
      res.status(upstream.status === 404 ? 404 : 502).end();
      return;
    }

    const ct = upstream.headers.get('content-type') || '';
    if (!ct.startsWith('image/')) {
      res.status(502).end();
      return;
    }

    res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
    res.status(200).send(Buffer.from(await upstream.arrayBuffer()));
  } catch {
    res.status(502).end();
  }
}
