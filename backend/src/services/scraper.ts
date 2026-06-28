import axios from 'axios';
import * as cheerio from 'cheerio';
import { query } from '../db/index';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScrapedListing {
  id: string;
  source: 'bayut' | 'propertyfinder' | 'dubizzle' | 'houza' | 'dld';
  title: string;
  price: number;          // annual AED
  beds: number;
  baths: number;
  sizeSqft: number;
  area: string;
  community: string;
  url: string;
  isVerified: boolean;
  isFurnished: boolean;
  cheques: number | null; // number of cheques allowed
  agentName: string;
  agencyName: string;
  listedDays: number;     // days since listed
  priceDropPct: number;   // 0 if no drop
  scrapedAt: Date;
}

export interface MarketIntelligence {
  area: string;
  beds: number;
  listingCount: number;
  minPrice: number;
  maxPrice: number;
  medianPrice: number;
  avgPrice: number;
  priceTrend: 'rising' | 'stable' | 'falling';
  bestDeal: ScrapedListing | null;
  sources: string[];
  scrapedAt: Date;
}

// ─── URL Builders ─────────────────────────────────────────────────────────────

const AREA_SLUGS: Record<string, { bayut: string; pf: string; dubizzle: string }> = {
  'downtown dubai':     { bayut: 'downtown-dubai',     pf: 'downtown-dubai',     dubizzle: 'downtown-dubai' },
  'dubai marina':       { bayut: 'dubai-marina',       pf: 'dubai-marina',       dubizzle: 'dubai-marina' },
  'jvc':                { bayut: 'jumeirah-village-circle-jvc', pf: 'jumeirah-village-circle', dubizzle: 'jumeirah-village-circle' },
  'jumeirah village circle': { bayut: 'jumeirah-village-circle-jvc', pf: 'jumeirah-village-circle', dubizzle: 'jumeirah-village-circle' },
  'deira':              { bayut: 'deira',               pf: 'deira',              dubizzle: 'deira' },
  'al nahda':           { bayut: 'al-nahda-dubai',     pf: 'al-nahda',           dubizzle: 'al-nahda-dubai' },
  'bur dubai':          { bayut: 'bur-dubai',           pf: 'bur-dubai',          dubizzle: 'bur-dubai' },
  'international city': { bayut: 'international-city', pf: 'international-city', dubizzle: 'international-city' },
  'silicon oasis':      { bayut: 'dubai-silicon-oasis', pf: 'dubai-silicon-oasis', dubizzle: 'dubai-silicon-oasis' },
  'dubai silicon oasis':{ bayut: 'dubai-silicon-oasis', pf: 'dubai-silicon-oasis', dubizzle: 'dubai-silicon-oasis' },
  'sport city':         { bayut: 'dubai-sports-city',  pf: 'dubai-sports-city',  dubizzle: 'dubai-sports-city' },
  'discovery gardens':  { bayut: 'discovery-gardens',  pf: 'discovery-gardens',  dubizzle: 'discovery-gardens' },
  'al barsha':          { bayut: 'al-barsha',           pf: 'al-barsha',          dubizzle: 'al-barsha' },
  'motor city':         { bayut: 'motor-city',          pf: 'motor-city',         dubizzle: 'motor-city' },
};

function buildBayutUrl(beds: number, maxPrice: number, area?: string): string {
  const bedsStr = beds === 0 ? 'studio' : `${beds}br`;
  const areaSlug = area ? AREA_SLUGS[area.toLowerCase()]?.bayut : undefined;
  if (areaSlug) {
    return `https://www.bayut.com/to-rent/apartments/${areaSlug}/${bedsStr}-bedroom/?price_min=0&price_max=${maxPrice}`;
  }
  return `https://www.bayut.com/to-rent/apartments/dubai/${bedsStr}-bedroom/?price_min=0&price_max=${maxPrice}`;
}

function buildPropertyFinderUrl(beds: number, maxPrice: number, area?: string): string {
  const bedParam = beds === 0 ? 'studio' : `${beds}`;
  const areaSlug = area ? AREA_SLUGS[area.toLowerCase()]?.pf : undefined;
  const base = areaSlug
    ? `https://www.propertyfinder.ae/en/rent/dubai/${areaSlug}/apartments-for-rent.html`
    : `https://www.propertyfinder.ae/en/rent/dubai/apartments-for-rent.html`;
  return `${base}?bdr[]=${bedParam}&pt=${maxPrice}&fu=0&rp=y&ob=pa`;
}

function buildDubizzleUrl(beds: number, maxPrice: number, area?: string): string {
  const areaSlug = area ? AREA_SLUGS[area.toLowerCase()]?.dubizzle : undefined;
  if (areaSlug) {
    return `https://dubai.dubizzle.com/en/property-for-rent/residential/apartmentflat/in/${areaSlug}/and/${beds}-bedroom/?price__lte=${maxPrice}`;
  }
  return `https://dubai.dubizzle.com/en/property-for-rent/residential/n/${beds}-bedroom-apartments-under-aed-${maxPrice}-yearly-in-dubai/`;
}

// ─── HTTP helper with retry + random UA ───────────────────────────────────────

const USER_AGENTS = [
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
];

async function fetchPage(url: string): Promise<string | null> {
  const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await axios.get(url, {
        timeout: 20000,
        headers: {
          'User-Agent': ua,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,ar;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer': 'https://www.google.com/',
          'DNT': '1',
        },
      });
      return res.data as string;
    } catch (err: unknown) {
      const error = err as { response?: { status: number } };
      if (error.response?.status === 403 || error.response?.status === 429) {
        await new Promise(r => setTimeout(r, 3000 * attempt));
      } else {
        break;
      }
    }
  }
  return null;
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

function parsePrice(raw: string): number {
  const cleaned = raw.replace(/[^0-9]/g, '');
  return parseInt(cleaned, 10) || 0;
}

function parseDaysListed(raw: string): number {
  if (!raw) return 0;
  if (raw.includes('day')) return parseInt(raw) || 1;
  if (raw.includes('week')) return (parseInt(raw) || 1) * 7;
  if (raw.includes('month')) return (parseInt(raw) || 1) * 30;
  return 0;
}

function parsePriceDrop(raw: string): number {
  const match = raw.match(/(\d+)%/);
  return match ? parseInt(match[1]) : 0;
}

// ─── Bayut Scraper ────────────────────────────────────────────────────────────

async function scrapeBayut(beds: number, maxPrice: number, area?: string): Promise<ScrapedListing[]> {
  const url = buildBayutUrl(beds, maxPrice, area);
  const html = await fetchPage(url);
  if (!html) return [];

  const $ = cheerio.load(html);
  const listings: ScrapedListing[] = [];

  // Bayut uses JSON-LD and data attributes; try multiple selectors
  $('[data-testid="property-card"], .listing-card, article[class*="property"]').each((i, el) => {
    try {
      const $el = $(el);
      const priceRaw = $el.find('[data-testid="listing-price"], .price, [class*="price"]').first().text().trim();
      const price = parsePrice(priceRaw);
      if (price === 0 || price > maxPrice * 1.1) return;

      const title = $el.find('h2, h3, [data-testid="listing-title"]').first().text().trim();
      const areaText = $el.find('[data-testid="listing-location"], [class*="location"]').first().text().trim();
      const bedsText = $el.find('[data-testid="property-beds"], [aria-label*="bed"]').first().text().trim();
      const bathsText = $el.find('[data-testid="property-baths"], [aria-label*="bath"]').first().text().trim();
      const sizeText = $el.find('[data-testid="property-area"], [aria-label*="sqft"]').first().text().trim();
      const href = $el.find('a').first().attr('href') || '';

      listings.push({
        id: `bayut-${i}-${Date.now()}`,
        source: 'bayut',
        title: title || `${beds}BR in ${area || 'Dubai'}`,
        price,
        beds,
        baths: parseInt(bathsText) || 1,
        sizeSqft: parseFloat(sizeText.replace(/[^0-9.]/g, '')) || 0,
        area: areaText.split(',')[1]?.trim() || area || 'Dubai',
        community: areaText.split(',')[0]?.trim() || '',
        url: href.startsWith('http') ? href : `https://www.bayut.com${href}`,
        isVerified: $el.text().toLowerCase().includes('verified'),
        isFurnished: $el.text().toLowerCase().includes('furnished'),
        cheques: null,
        agentName: $el.find('[class*="agent-name"]').first().text().trim() || '',
        agencyName: $el.find('[class*="agency"]').first().text().trim() || '',
        listedDays: 0,
        priceDropPct: 0,
        scrapedAt: new Date(),
      });
    } catch (_) { /* skip malformed */ }
  });

  // Fallback: extract from JSON-LD
  if (listings.length === 0) {
    const jsonLdMatches = html.match(/<script type="application\/json"[^>]*>([\s\S]*?)<\/script>/g) || [];
    for (const block of jsonLdMatches.slice(0, 10)) {
      try {
        const json = JSON.parse(block.replace(/<script[^>]*>/, '').replace('</script>', ''));
        if (json?.props?.pageProps?.searchResult?.hits) {
          for (const hit of json.props.pageProps.searchResult.hits.slice(0, 20)) {
            const price = hit.price || hit.rentFrequency === 'yearly' ? hit.price : 0;
            if (!price) continue;
            listings.push({
              id: `bayut-${hit.id}`,
              source: 'bayut',
              title: hit.title || '',
              price: parseInt(price),
              beds: hit.beds || beds,
              baths: hit.baths || 1,
              sizeSqft: hit.area || 0,
              area: hit.location?.[2]?.name || area || 'Dubai',
              community: hit.location?.[1]?.name || '',
              url: `https://www.bayut.com${hit.externalID ? `/property/${hit.externalID}` : ''}`,
              isVerified: hit.isVerified || false,
              isFurnished: hit.furnishingStatus === 'furnished',
              cheques: hit.permitNumber ? null : null,
              agentName: hit.contactName || '',
              agencyName: hit.agency?.name || '',
              listedDays: 0,
              priceDropPct: 0,
              scrapedAt: new Date(),
            });
          }
          if (listings.length > 0) break;
        }
      } catch (_) { /* skip */ }
    }
  }

  return listings;
}

// ─── PropertyFinder Scraper ───────────────────────────────────────────────────

async function scrapePropertyFinder(beds: number, maxPrice: number, area?: string): Promise<ScrapedListing[]> {
  const url = buildPropertyFinderUrl(beds, maxPrice, area);
  const html = await fetchPage(url);
  if (!html) return [];

  const $ = cheerio.load(html);
  const listings: ScrapedListing[] = [];

  // PropertyFinder listing structure
  $('li[class*="card"], article[class*="card"], [class*="property-card"]').each((i, el) => {
    try {
      const $el = $(el);
      const priceText = $el.find('[class*="price"], [data-testid*="price"]').first().text();
      const price = parsePrice(priceText);
      if (price === 0 || price > maxPrice * 1.1) return;

      const title = $el.find('h2, h3, [class*="title"]').first().text().trim();
      const location = $el.find('[class*="location"], [data-testid*="location"]').first().text().trim();
      const bedsText = $el.find('[class*="beds"], [data-testid*="beds"]').first().text();
      const bathsText = $el.find('[class*="baths"], [data-testid*="baths"]').first().text();
      const sizeText = $el.find('[class*="area"], [class*="size"]').first().text();
      const href = $el.find('a[href*="/plp/"], a[href*="/rent/"]').first().attr('href') || '';
      const listedText = $el.find('[class*="listed"], [class*="date"]').first().text();
      const dropText = $el.find('[class*="drop"], [class*="reduction"]').first().text();
      const verified = $el.find('[class*="verified"], [class*="badge"]').text().toLowerCase().includes('verified');

      listings.push({
        id: `pf-${i}-${Date.now()}`,
        source: 'propertyfinder',
        title,
        price,
        beds: parseInt(bedsText) || beds,
        baths: parseInt(bathsText) || 1,
        sizeSqft: parseFloat(sizeText.replace(/[^0-9.]/g, '')) || 0,
        area: location.split(',').slice(-2, -1)[0]?.trim() || area || 'Dubai',
        community: location.split(',')[0]?.trim() || '',
        url: href.startsWith('http') ? href : `https://www.propertyfinder.ae${href}`,
        isVerified: verified,
        isFurnished: $el.text().toLowerCase().includes('furnished'),
        cheques: null,
        agentName: $el.find('[class*="agent"]').first().text().trim() || '',
        agencyName: $el.find('[class*="agency"], img[alt*="logo"]').first().attr('alt') || '',
        listedDays: parseDaysListed(listedText),
        priceDropPct: parsePriceDrop(dropText),
        scrapedAt: new Date(),
      });
    } catch (_) { /* skip */ }
  });

  // Fallback: JSON in page
  if (listings.length === 0) {
    const match = html.match(/"listings":\s*(\[[\s\S]*?\])/);
    if (match) {
      try {
        const items = JSON.parse(match[1]);
        for (const item of items.slice(0, 20)) {
          const price = item.price || item.annual_price || 0;
          if (!price || price > maxPrice * 1.1) continue;
          listings.push({
            id: `pf-json-${item.id || Math.random()}`,
            source: 'propertyfinder',
            title: item.title || item.name || '',
            price: parseInt(price),
            beds: item.bedrooms || beds,
            baths: item.bathrooms || 1,
            sizeSqft: item.area || 0,
            area: item.location?.community || area || 'Dubai',
            community: item.location?.building || '',
            url: item.url || item.link || '',
            isVerified: item.is_verified || false,
            isFurnished: item.furnishing === 'furnished',
            cheques: item.cheques || null,
            agentName: item.agent?.name || '',
            agencyName: item.agency?.name || '',
            listedDays: 0,
            priceDropPct: item.price_drop_percentage || 0,
            scrapedAt: new Date(),
          });
        }
      } catch (_) { /* skip */ }
    }
  }

  return listings;
}

// ─── Dubizzle Scraper ─────────────────────────────────────────────────────────

async function scrapeDubizzle(beds: number, maxPrice: number, area?: string): Promise<ScrapedListing[]> {
  const url = buildDubizzleUrl(beds, maxPrice, area);
  const html = await fetchPage(url);
  if (!html) return [];

  const $ = cheerio.load(html);
  const listings: ScrapedListing[] = [];

  // Dubizzle listing cards
  $('[class*="listing-card"], [class*="card-details"], a[href*="/property-for-rent/"]').each((i, el) => {
    try {
      const $el = $(el);
      const priceText = $el.find('[class*="price"], strong').first().text();
      const price = parsePrice(priceText);
      if (price === 0 || price > maxPrice * 1.1) return;

      const title = $el.find('h2, h3, [class*="title"]').first().text().trim();
      const location = $el.find('[class*="location"], [class*="address"]').first().text().trim();
      const sizeText = $el.find('[class*="size"], [class*="area"]').first().text();
      const href = $el.is('a') ? $el.attr('href') : $el.find('a').first().attr('href') || '';
      const verified = $el.find('[class*="verified"]').length > 0;

      listings.push({
        id: `dubizzle-${i}-${Date.now()}`,
        source: 'dubizzle',
        title,
        price,
        beds,
        baths: 1,
        sizeSqft: parseFloat(sizeText.replace(/[^0-9.]/g, '')) || 0,
        area: location.split(',').slice(-2, -1)[0]?.trim() || area || 'Dubai',
        community: location.split(',')[0]?.trim() || '',
        url: href?.startsWith('http') ? href : `https://dubai.dubizzle.com${href}`,
        isVerified: verified,
        isFurnished: $el.text().toLowerCase().includes('furnished'),
        cheques: null,
        agentName: '',
        agencyName: '',
        listedDays: 0,
        priceDropPct: 0,
        scrapedAt: new Date(),
      });
    } catch (_) { /* skip */ }
  });

  return listings;
}

// ─── DLD Rent Index (public web data) ────────────────────────────────────────

export async function getDldRentalBenchmark(area: string, beds: number): Promise<{
  benchmarkMin: number;
  benchmarkMax: number;
  benchmarkAvg: number;
  source: string;
} | null> {
  // DLD Rental Index page — scrape the search result table
  // The portal requires CAPTCHA for API queries, so we use the search results page
  // and fall back to Dubai Pulse open data CSV exports for historical data
  const searchUrl = `https://dubailand.gov.ae/en/eservices/rental-index-calculator/#/`;
  const html = await fetchPage(searchUrl);
  if (!html) return null;

  const $ = cheerio.load(html);
  const rows: number[] = [];

  $('table tr').each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length === 0) return;
    const rowText = $(row).text().toLowerCase();
    if (!rowText.includes(area.toLowerCase())) return;

    const bedsMatch = rowText.includes(`${beds} bedroom`) || rowText.includes(`${beds}br`);
    if (!bedsMatch) return;

    cells.each((_, cell) => {
      const val = parsePrice($(cell).text());
      if (val > 10000 && val < 500000) rows.push(val);
    });
  });

  if (rows.length < 2) return null;

  rows.sort((a, b) => a - b);
  return {
    benchmarkMin: rows[0],
    benchmarkMax: rows[rows.length - 1],
    benchmarkAvg: Math.round(rows.reduce((a, b) => a + b, 0) / rows.length),
    source: 'DLD Rental Index',
  };
}

// ─── Aggregator & Intelligence Engine ────────────────────────────────────────

function deduplicate(listings: ScrapedListing[]): ScrapedListing[] {
  const seen = new Set<string>();
  return listings.filter(l => {
    // Deduplicate by price + area + size (same unit listed on multiple sites)
    const key = `${l.price}-${l.area}-${Math.round(l.sizeSqft / 50) * 50}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function computeMedian(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

export async function scrapeAllSources(
  beds: number,
  maxPrice: number,
  area?: string,
  minPrice: number = 0
): Promise<{ listings: ScrapedListing[]; intelligence: MarketIntelligence }> {

  // Run all scrapers in parallel
  const [bayut, pf, dubizzle] = await Promise.allSettled([
    scrapeBayut(beds, maxPrice, area),
    scrapePropertyFinder(beds, maxPrice, area),
    scrapeDubizzle(beds, maxPrice, area),
  ]);

  const all: ScrapedListing[] = [
    ...(bayut.status === 'fulfilled' ? bayut.value : []),
    ...(pf.status === 'fulfilled' ? pf.value : []),
    ...(dubizzle.status === 'fulfilled' ? dubizzle.value : []),
  ].filter(l => l.price >= minPrice && l.price <= maxPrice);

  const deduped = deduplicate(all);
  const prices = deduped.map(l => l.price).sort((a, b) => a - b);

  const sources = [...new Set(deduped.map(l => l.source))];

  // Detect trend: compare first-listed vs recent
  const oldListings = deduped.filter(l => l.listedDays > 30);
  const newListings = deduped.filter(l => l.listedDays <= 14);
  const oldAvg = oldListings.length ? oldListings.reduce((s, l) => s + l.price, 0) / oldListings.length : 0;
  const newAvg = newListings.length ? newListings.reduce((s, l) => s + l.price, 0) / newListings.length : 0;
  const priceTrend: 'rising' | 'stable' | 'falling' =
    newAvg > oldAvg * 1.03 ? 'rising' :
    newAvg < oldAvg * 0.97 ? 'falling' : 'stable';

  // Best deal = verified, lowest price, recent listing
  const bestDeal = deduped
    .filter(l => l.isVerified || l.priceDropPct > 0)
    .sort((a, b) => (a.price + a.priceDropPct * -100) - (b.price + b.priceDropPct * -100))[0] || deduped[0] || null;

  const intelligence: MarketIntelligence = {
    area: area || 'Dubai',
    beds,
    listingCount: deduped.length,
    minPrice: prices[0] || 0,
    maxPrice: prices[prices.length - 1] || 0,
    medianPrice: computeMedian(prices),
    avgPrice: prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0,
    priceTrend,
    bestDeal,
    sources,
    scrapedAt: new Date(),
  };

  // Cache to DB
  await cacheListings(deduped, intelligence);

  return { listings: deduped, intelligence };
}

// ─── DB Caching ───────────────────────────────────────────────────────────────

async function cacheListings(listings: ScrapedListing[], intel: MarketIntelligence): Promise<void> {
  try {
    // Upsert market intelligence summary
    await query(
      `INSERT INTO market_intel (area, beds, listing_count, min_price, max_price, median_price, avg_price, price_trend, best_deal_url, sources, scraped_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
       ON CONFLICT (area, beds) DO UPDATE SET
         listing_count = EXCLUDED.listing_count,
         min_price = EXCLUDED.min_price,
         max_price = EXCLUDED.max_price,
         median_price = EXCLUDED.median_price,
         avg_price = EXCLUDED.avg_price,
         price_trend = EXCLUDED.price_trend,
         best_deal_url = EXCLUDED.best_deal_url,
         sources = EXCLUDED.sources,
         scraped_at = NOW()`,
      [
        intel.area, intel.beds, intel.listingCount,
        intel.minPrice, intel.maxPrice, intel.medianPrice, intel.avgPrice,
        intel.priceTrend, intel.bestDeal?.url || null,
        intel.sources.join(',')
      ]
    );
  } catch (_) {
    // DB not connected during dev — silent fail
  }
}

// ─── Quick search for Layla (AI conversation use) ─────────────────────────────

export async function quickMarketSearch(query_text: string): Promise<string> {
  // Parse natural language: beds, area, budget
  const bedsMatch = query_text.match(/(\d+)\s*b(hk|r|ed)|studio/i);
  const beds = bedsMatch ? (bedsMatch[0].toLowerCase().includes('studio') ? 0 : parseInt(bedsMatch[1])) : 1;

  const budgetMatch = query_text.match(/(\d[\d,]*)\s*k?/gi);
  let maxPrice = 80000;
  if (budgetMatch) {
    const nums = budgetMatch.map(m => {
      const n = parseInt(m.replace(/,/g, ''));
      return m.toLowerCase().includes('k') ? n * 1000 : n;
    }).filter(n => n > 10000 && n < 1000000);
    if (nums.length) maxPrice = Math.max(...nums);
  }

  const areaKeywords = Object.keys(AREA_SLUGS);
  const detectedArea = areaKeywords.find(a =>
    query_text.toLowerCase().includes(a.toLowerCase())
  );

  const { listings, intelligence } = await scrapeAllSources(beds, maxPrice, detectedArea);

  if (listings.length === 0) {
    return `I searched across Bayut, PropertyFinder, and Dubizzle for ${beds}BHK up to AED ${maxPrice.toLocaleString()} ${detectedArea ? `in ${detectedArea}` : 'in Dubai'}, but no listings found right now. Try a slightly higher budget?`;
  }

  const top3 = listings.slice(0, 3);
  const verifiedCount = listings.filter(l => l.isVerified).length;

  return `📊 **Live Market Data** (${intelligence.sources.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' + ')})\n\n` +
    `Found **${intelligence.listingCount} listings** for ${beds}BHK ${detectedArea ? `in ${detectedArea}` : 'in Dubai'} under AED ${maxPrice.toLocaleString()}:\n\n` +
    `• **Range:** AED ${intelligence.minPrice.toLocaleString()} – ${intelligence.maxPrice.toLocaleString()}/yr\n` +
    `• **Median:** AED ${intelligence.medianPrice.toLocaleString()}/yr\n` +
    `• **Trend:** ${intelligence.priceTrend === 'rising' ? '📈 Rising' : intelligence.priceTrend === 'falling' ? '📉 Falling' : '➡️ Stable'}\n` +
    `• **Verified listings:** ${verifiedCount} of ${intelligence.listingCount}\n\n` +
    `**Top Matches:**\n` +
    top3.map((l, i) =>
      `${i + 1}. ${l.title || `${beds}BHK in ${l.area}`}\n   💰 AED ${l.price.toLocaleString()}/yr${l.isVerified ? ' ✅ Verified' : ''}${l.priceDropPct > 0 ? ` 🔻${l.priceDropPct}% drop` : ''}\n   📍 ${l.community}, ${l.area} | 🔗 ${l.source}\n`
    ).join('\n') +
    `\n${intelligence.bestDeal && intelligence.bestDeal.priceDropPct > 0 ? `🔥 **Best deal:** ${intelligence.bestDeal.priceDropPct}% price drop on a verified listing — I can get the agent's details instantly.\n` : ''}` +
    `\nWant me to shortlist, book viewings, or check if your AED ${maxPrice.toLocaleString()} budget gives negotiation room? 💬`;
}
