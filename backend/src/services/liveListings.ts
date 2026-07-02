/**
 * liveListings.ts — Unified live property search
 *
 * Priority:
 * 1. Bayut website scraper (no API key, always fresh, real photos)
 * 2. Bayut RapidAPI (if key subscribed)
 * 3. PropertyFinder RapidAPI (fallback)
 */

import { scrapeBayutListings }    from './bayutScraper';
import { fetchBayutListings }     from './bayutApi';
import { fetchFromPropertyFinder } from './propertyFinderApi';
import { Property }               from './propertyService';

export interface LiveSearchFilters {
  intent?:        string;   // 'buy' | 'rent' | 'invest' | 'off-plan' | 'golden-visa'
  propertyType?:  string;
  area?:          string;
  budgetMin?:     number;
  budgetMax?:     number;
  bedrooms?:      string;   // '1' | '2' | '3' | 'studio' etc
}

function intentToPurpose(intent?: string): 'for-rent' | 'for-sale' {
  if (!intent) return 'for-rent';
  const i = intent.toLowerCase();
  if (i.includes('rent')) return 'for-rent';
  return 'for-sale';
}

function bedsToMinMax(bedrooms?: string): { bedsMin?: number; bedsMax?: number } {
  if (!bedrooms) return {};
  if (bedrooms === 'studio') return { bedsMin: 0, bedsMax: 0 };
  const n = parseInt(bedrooms, 10);
  if (isNaN(n)) return {};
  return { bedsMin: n, bedsMax: n };
}

export async function fetchLiveListings(
  filters: LiveSearchFilters,
  limit = 6
): Promise<{ properties: Property[]; sources: string[] }> {

  const purpose = intentToPurpose(filters.intent);
  const { bedsMin, bedsMax } = bedsToMinMax(filters.bedrooms);

  const bayutParams = {
    purpose,
    propertyType: filters.propertyType,
    area:         filters.area,
    bedsMin,
    bedsMax,
    priceMin:     filters.budgetMin,
    priceMax:     filters.budgetMax,
    limit:        limit + 4,
  };

  // Run all three sources in parallel
  const [scraped, bayutApi, pfApi] = await Promise.allSettled([
    scrapeBayutListings(bayutParams),
    fetchBayutListings(bayutParams),
    fetchFromPropertyFinder(filters, limit + 4),
  ]);

  const scrapedResults = scraped.status  === 'fulfilled' ? scraped.value  : [];
  const bayutResults   = bayutApi.status === 'fulfilled' ? bayutApi.value : [];
  const pfResults      = pfApi.status    === 'fulfilled' ? pfApi.value    : [];

  console.log(`[liveListings] scraper=${scrapedResults.length} bayutApi=${bayutResults.length} pf=${pfResults.length}`);

  const sources: string[] = [];
  if (scrapedResults.length > 0) sources.push('Bayut');
  if (bayutResults.length > 0)   sources.push('Bayut API');
  if (pfResults.length > 0)      sources.push('PropertyFinder');

  // Merge: scraper first (freshest), then API results
  const allResults = [...scrapedResults, ...bayutResults, ...pfResults];

  // Deduplicate by id/refNo/title
  const seen = new Set<string>();
  const deduped: Property[] = [];
  for (const p of allResults) {
    const key = p.id || p.refNo || p.title;
    if (key && !seen.has(key)) {
      seen.add(key);
      deduped.push(p);
    }
  }

  // Score and rank
  const areaLower = filters.area?.toLowerCase() ?? '';
  const bedsNum   = parseInt(filters.bedrooms ?? '', 10);

  const scored = deduped.map(p => {
    let score = 0;
    if (areaLower && p.area?.toLowerCase().includes(areaLower))           score += 10;
    if (areaLower && p.community?.toLowerCase().includes(areaLower))      score += 8;
    if (p.photoUrls && p.photoUrls.length > 0)                            score += 5;
    if (p.photoUrls && p.photoUrls.length >= 3)                           score += 2;
    if (!isNaN(bedsNum) && Number(p.bedrooms) === bedsNum)                score += 3;
    if (filters.budgetMax && p.price <= filters.budgetMax)                score += 2;
    if (filters.budgetMax && p.price <= filters.budgetMax * 0.9)          score += 1;
    if (p.daysOnMarket != null && p.daysOnMarket < 30)                    score += 1;
    return { p, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return {
    properties: scored.slice(0, limit).map(s => s.p),
    sources,
  };
}
