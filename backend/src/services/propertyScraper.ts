/**
 * Live property scraper — called when DB returns 0 results for an area.
 * Fetches PropertyFinder search page, extracts price ranges via regex,
 * and returns structured market intelligence + deep-link for the user.
 */

export interface LiveMarketData {
  area: string;
  bedrooms: string;
  listingType: 'sale' | 'rent';
  priceMin: number;
  priceMax: number;
  priceAvg: number;
  count: number;
  pfUrl: string;
  source: string;
}

const AREA_SLUGS: Record<string, string> = {
  'ritaj': 'ritaj-international-city',
  'international city': 'international-city',
  'motor city': 'motor-city',
  'sports city': 'dubai-sports-city',
  'dubai sports city': 'dubai-sports-city',
  'arjan': 'arjan',
  'remraam': 'remraam',
  'dubailand': 'dubailand',
  'al warsan': 'al-warsan',
  'discovery gardens': 'discovery-gardens',
  'green community': 'green-community',
  'meadows': 'the-meadows',
  'the springs': 'the-springs',
  'lakes': 'the-lakes',
  'the lakes': 'the-lakes',
  'mudon': 'mudon',
  'serena': 'serena',
  'villanova': 'villanova',
  'town square': 'town-square',
  'al furjan': 'al-furjan',
  'furjan': 'al-furjan',
  'dubai marina': 'dubai-marina',
  'marina': 'dubai-marina',
  'downtown': 'downtown-dubai',
  'jvc': 'jumeirah-village-circle',
  'business bay': 'business-bay',
  'jbr': 'jumeirah-beach-residence',
  'palm': 'palm-jumeirah',
  'difc': 'difc',
  'dubai hills': 'dubai-hills-estate',
  'mirdif': 'mirdif',
  'deira': 'deira',
  'silicon oasis': 'dubai-silicon-oasis',
  'dso': 'dubai-silicon-oasis',
  'creek harbour': 'dubai-creek-harbour',
  'damac hills': 'damac-hills',
  'jumeirah': 'jumeirah',
  'al barsha': 'al-barsha',
  'barsha': 'al-barsha',
};

function buildPFUrl(area: string, bedrooms: string, listingType: 'sale' | 'rent'): string {
  const areaSlug = AREA_SLUGS[area.toLowerCase()] || area.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const c = listingType === 'rent' ? '1' : '2';
  const t = '1'; // apartment default
  const bds = bedrooms === 'studio' ? 'S' : bedrooms;
  return `https://www.propertyfinder.ae/en/search?c=${c}&t=${t}&bds=${bds}&l=${areaSlug}`;
}

async function scrapePFPrices(url: string): Promise<number[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return [];
    const html = await res.text();
    // Extract prices — PF embeds prices as data in HTML: "price":NNNNNN
    const priceMatches = html.match(/"price"\s*:\s*(\d{4,9})/g) || [];
    const prices = priceMatches
      .map(m => parseInt(m.replace(/[^0-9]/g, '')))
      .filter(p => p > 10000 && p < 200000000); // reasonable AED range
    return prices;
  } catch {
    return [];
  }
}

export async function getLiveMarketData(
  area: string,
  bedrooms: string,
  listingType: 'sale' | 'rent'
): Promise<LiveMarketData | null> {
  try {
    const pfUrl = buildPFUrl(area, bedrooms, listingType);
    const prices = await scrapePFPrices(pfUrl);

    if (prices.length === 0) return null;

    const sorted = prices.sort((a, b) => a - b);
    const priceMin = sorted[0];
    const priceMax = sorted[sorted.length - 1];
    const priceAvg = Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length);

    return {
      area,
      bedrooms,
      listingType,
      priceMin,
      priceMax,
      priceAvg,
      count: prices.length,
      pfUrl,
      source: 'PropertyFinder',
    };
  } catch {
    return null;
  }
}

export function formatLiveMarketMessage(data: LiveMarketData): string {
  const bedsLabel = data.bedrooms === 'studio' ? 'Studio' : `${data.bedrooms}BR`;
  const listLabel = data.listingType === 'rent' ? 'rent' : 'sale';
  const priceLabel = data.listingType === 'rent' ? '/yr' : '';
  const fmtPrice = (p: number) => `AED ${p.toLocaleString()}${priceLabel}`;

  return `I found live market data for ${bedsLabel} apartments in ${data.area} for ${listLabel}:\n\n` +
    `📊 **${data.area} Market Snapshot:**\n` +
    `• Price range: ${fmtPrice(data.priceMin)} – ${fmtPrice(data.priceMax)}\n` +
    `• Average: ${fmtPrice(data.priceAvg)}\n` +
    `• ${data.count} listings found on PropertyFinder\n\n` +
    `🔗 View all listings: ${data.pfUrl}\n\n` +
    `Would you like me to show you similar options from nearby areas that I can arrange viewings for directly? 🏠`;
}
