/**
 * Route link-preview crawlers to dynamic OG HTML.
 * Real browsers (incl. WhatsApp in-app Safari) must get the SPA — not og-meta.
 */
import { rewrite } from '@vercel/functions';

/** Meta / social preview bots — never used for human navigation. */
const CRAWLER_UA = /facebookexternalhit|facebot|meta-externalagent|twitterbot|telegrambot|linkedinbot|slackbot|discordbot|googlebot|bingbot|ia_archiver|embedly|pinterest|vkshare|w3c_validator/i;

const SKIP = /^\/(api\/|assets\/|sitemap\.xml|robots\.txt|favicon\.ico)/;

export const config = {
  matcher: ['/((?!api/|assets/).*)'],
};

function isBrowserNavigation(request) {
  const mode = request.headers.get('sec-fetch-mode');
  const dest = request.headers.get('sec-fetch-dest');
  const user = request.headers.get('sec-fetch-user');
  // Modern browsers (Safari iOS, Chrome, WhatsApp in-app webview) send these on link opens.
  if (mode === 'navigate' || dest === 'document' || user === '?1') return true;
  return false;
}

function isInAppSocialBrowser(request) {
  const ua = request.headers.get('user-agent') || '';
  // Instagram / Facebook in-app WebViews — always serve the SPA, never og-meta.
  return /Instagram|FB_IAB|FBAN\/|FBAV\/|Messenger/i.test(ua);
}

function isPreviewCrawler(request) {
  const ua = request.headers.get('user-agent') || '';
  if (isInAppSocialBrowser(request)) return false;
  if (CRAWLER_UA.test(ua)) return true;
  // WhatsApp link-preview fetch (not in-app browser): WhatsApp/x.x without browser Sec-Fetch headers.
  if (/^WhatsApp\/\d/i.test(ua) && !isBrowserNavigation(request)) return true;
  return false;
}

export default function middleware(request) {
  const url = new URL(request.url);
  if (SKIP.test(url.pathname)) return;
  // After og-meta redirect — serve SPA (prevents redirect loop on mobile).
  if (url.searchParams.has('_p')) return;
  if (!isPreviewCrawler(request)) return;

  const dest = new URL(request.url);
  dest.pathname = '/api/og-meta';
  return rewrite(dest);
}
