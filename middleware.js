/**
 * Route link-preview crawlers (WhatsApp, Telegram, …) to dynamic OG HTML.
 * Browsers send Sec-Fetch-User; most crawlers do not.
 */
import { rewrite } from '@vercel/functions';

const BOT_UA = /whatsapp|facebookexternalhit|meta-externalagent|twitterbot|telegrambot|linkedinbot|slackbot|discordbot|googlebot|bingbot|facebot|ia_archiver|embedly|pinterest|vkshare|w3c_validator/i;

const SKIP = /^\/(api\/|assets\/|sitemap\.xml|robots\.txt|favicon\.ico)/;

export const config = {
  matcher: ['/((?!api/|assets/).*)'],
};

export default function middleware(request) {
  const url = new URL(request.url);
  if (SKIP.test(url.pathname)) return;

  const ua = request.headers.get('user-agent') || '';
  const isUserNav = request.headers.get('sec-fetch-user') === '?1';
  if (isUserNav && !BOT_UA.test(ua)) return;

  const dest = new URL(request.url);
  dest.pathname = '/api/og-meta';
  return rewrite(dest);
}
