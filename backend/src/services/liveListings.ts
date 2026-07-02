/**
 * liveListings.ts — Unified live property search
 *
 * Runs Bayut + PropertyFinder in parallel, merges, deduplicates,
 * and returns the best-matching listings sorted by relevance.
 */

import { Property } from './propertyService';
import { fetchBayutListings, parseBedsForBayut } from './bayutApi';
import { fetchFromPropertyFinder } from './propertyFinderApi';

export interface LiveSearchFilters {
  intent?:        string;
  propertyType?:  string;
  area?:          string;
  budgetMin?:     number;
  budgetMax?:     number;
  bedrooms?:      string;
}

// How many to fetch from each source
const PER_SOURCE = 6;

// ── Deduplication: remove listings with same price + area + bedrooms ──────────
function deduplicate(listings: Property[]): Property[] {
  const seen = new Set<string>();
  return listings.filter(p => {
    const key = `${p.area.toLowerCase()}-${p.bedrooms}-${p.price}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Score a listing for relevance (higher = better match) ────────────────────
function score(p: Property, filters: LiveSearchFilters): number {
  let s = 0;

  // Has photos → big boost (authenticity)
  if (p.photoUrls && p.photoUrls.length > 0) s += 30;

  // Area match
  if (filters.area) {
    const area = filters.area.toLowerCase();
    const pArea = (p.area + ' ' + p.community).toLowerCase();
    if (pArea.includes(area)) s += 40;
  }

  // Bedroom exact match
  if (filters.bedrooms) {
    const want = filters.bedrooms.toLowerCase().trim();
    const have = p.bedrooms.toLowerCase().trim();
    if (want === have) s += 20;
    if ((want === 'studio' || want === '0') && (have === 'studio' || have === '0')) s += 20;
  }

  // Budget range
  if (filters.budgetMax && p.price <= filters.budgetMax) s += 10;
  if (filters.budgetMin && p.price >= filters.budgetMin) s += 5;

  // Verified / featured
  if (p.isFeatured) s += 5;

  // Recent listings preferred
  if (p.daysOnMarket < 7)  s += 8;
  if (p.daysOnMarket < 30) s += 4;

  return s;
}

// ── Intent → Bayut purpose param ─────────────────────────────────────────────
function toBayutPurpose(intent?: string): 'for-rent' | 'for-sale' {
  if (!intent) return 'for-rent';
  const i = intent.toLowerCase();
  if (i.includes('buy') || i.includes('sale') || i.includes('purchase')) return 'for-sale';
  return 'for-rent';
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function fetchLiveListings(
  filters: LiveSearchFilters,
  limit = 6
): Promise<{ properties: Property[]; sources: string[] }> {

  console.log('[liveListings] fetching from Bayut + PropertyFinder in parallel');

  const { bedsMin, bedsMax } = parseBedsForBayut(filters.bedrooms);

  // Fire both in parallel — if one fails, it returns []
  const [bayutResult, pfResult] = await Promise.allSettled([
    fetchBayutListings({
      purpose:      toBayutPurpose(filters.intent),
      propertyType: filters.propertyType,
      area:         filters.area,
      bedsMin,
      bedsMax,
      priceMin:     filters.budgetMin,
      priceMax:     filters.budgetMax,
      limit:        PER_SOURCE,
    }),
    fetchFromPropertyFinder(filters, PER_SOURCE),
  ]);

  const sources: string[] = [];
  let combined: Property[] = [];

  if (bayutResult.status === 'fulfilled' && bayutResult.value.length > 0) {
    combined.push(...bayutResult.value.map((p: Property) => ({ ...p, source: 'bayut' })));
    sources.push('Bayut');
  }
  if (pfResult.status === 'fulfilled' && pfResult.value.length > 0) {
    combined.push(...pfResult.value);
    sources.push('PropertyFinder');
  }

  console.log(`[liveListings] ${combined.length} total before dedup (${sources.join(' + ')})`);

  combined = deduplicate(combined);
  combined.sort((a, b) => score(b, filters) - score(a, filters));

  const final = combined.slice(0, limit);
  console.log(`[liveListings] returning ${final.length} from: ${sources.join(', ')}`);

  return { properties: final, sources };
}

// Re-export for convenience
export { parseBedsForBayut };
