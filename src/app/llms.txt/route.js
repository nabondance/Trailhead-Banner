import { buildLlmsTxt } from '../../content/llms';
import { getBannerCount, formatBannerCount } from '../../utils/bannerCountUtils';

// Built once per deploy (route handlers are dynamic by default); the banner count refreshes on each deploy
export const dynamic = 'force-static';

export async function GET() {
  const formattedCount = formatBannerCount(await getBannerCount());
  return new Response(buildLlmsTxt({ formattedCount }), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
