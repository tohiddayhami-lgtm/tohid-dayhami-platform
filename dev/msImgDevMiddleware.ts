import type { Connect } from 'vite';

/** Local dev handler mirroring api/ms-img.js (Vite does not run Vercel functions). */
export const msImgDevMiddleware: Connect.NextHandleFunction = async (req, res, next) => {
  if (!req.url?.startsWith('/api/ms-img')) return next();

  try {
    const full = new URL(req.url, 'http://localhost');
    const raw = full.searchParams.get('u');
    if (!raw) {
      res.statusCode = 400;
      res.end();
      return;
    }

    const target = new URL(raw);
    if (target.protocol !== 'https:') {
      res.statusCode = 400;
      res.end();
      return;
    }

    const host = target.hostname.toLowerCase();
    const allowed =
      host.includes('kwcdn.com')
      || host.includes('digikala.com')
      || host.includes('firebasestorage.googleapis.com')
      || host.includes('firebasestorage.app')
      || host.endsWith('cloudfront.net')
      || /\.(jpg|jpeg|png|webp|gif|avif|bmp|svg)$/i.test(target.pathname);
    if (!allowed) {
      res.statusCode = 403;
      res.end();
      return;
    }

    const referer = host.includes('digikala.com')
      ? 'https://www.digikala.com/'
      : host.includes('kwcdn.com')
        ? 'https://www.temu.com/'
        : `${target.origin}/`;

    const upstream = await fetch(target.toString(), {
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: referer,
      },
      redirect: 'follow',
    });

    if (!upstream.ok) {
      res.statusCode = upstream.status === 404 ? 404 : 502;
      res.end();
      return;
    }

    const ct = upstream.headers.get('content-type') || '';
    if (!ct.startsWith('image/')) {
      res.statusCode = 502;
      res.end();
      return;
    }

    res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
    res.statusCode = 200;
    res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch {
    res.statusCode = 502;
    res.end();
  }
};
