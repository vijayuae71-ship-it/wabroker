/**
 * bayutApi.ts — Live property listings from Bayut via RapidAPI
 *
 * Replaces the seeded DB as the primary property source.
 * Returns the same `Property` interface the frontend already renders,
 * including real photo URLs, prices, and agent details.
 */

import axios from 'axios';
import { Property } from './propertyService';

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '';
const BAYUT_HOST   = 'bayut.p.rapidapi.com';

// ── Property type → Bayut categoryExternalID ──────────────────────────────────
const CATEGORY_IDS: Record<string, number> = {
  apartment:  4,
  flat:        4,
  studio:      4,
  villa:       3,
  townhouse:   5,
  penthouse:  38,
  duplex:      4,
};

// ── Pre-cached location IDs (avoids extra auto-complete call for common areas) ─
const LOCATION_CACHE: Record<string, number> = {
  'dubai marina':                          379,
  'downtown dubai':                        325,
  'business bay':                          236,
  'jumeirah village circle':              2393,
  'jvc':                                  2393,
  'deira':                                 264,
  'bur dubai':                            3638,
  'al mankool':                           3638,  // sub-area of Bur Dubai
  'mankhool':                             3638,  // common alternate spelling
  'al raffa':                             3638,  // sub-area of Bur Dubai
  'oud metha':                            3638,  // adjacent Bur Dubai area
  'al hamriya':                           3638,  // Bur Dubai sub-area
  'al fahidi':                            3638,  // Bur Dubai historic district
  'al jafiliya':                          3638,  // Bur Dubai sub-area
  'al barsha':                             281,
  'jbr':                                   425,
  'jumeirah beach residence':              425,
  'dubai hills':                         16736,
  'dubai hills estate':                  16736,
  'palm jumeirah':                         283,
  'arabian ranches':                       294,
  'al karama':                             385,
  'international city':                   2095,
  'ritaj':                                2095,
  'silicon oasis':                        2447,
  'dubai silicon oasis':                  2447,
  'discovery gardens':                    1486,
  'motor city':                           1636,
  'arjan':                               14789,
  'town square':                         23908,
  'dubai south':                         19489,
  'mirdif':                               1482,
  'al nahda':                             3770,
  'barsha heights':                       1480,
  'tecom':                                1480,
  'damac hills':                         16735,
  'jumeirah village triangle':           11815,
  'jvt':                                 11815,
  'creek harbour':                       22714,
  'dubai creek harbour':                 22714,
  'difc':                                  312,
  'jumeirah':                              282,
  'bluewaters':                          22573,
  'bluewaters island':                   22573,
  'al furjan':                           22419,
  'remraam':                             11902,
  'dubailand':                           12267,
  'dubai sports city':                    1496,
  'sport city':                           1496,
  'muhaisnah':                             388,
  'al quoz':                              1485,
  'nad al sheba':                         1491,
  'meydan':                              16710,
  'sobha hartland':                      22715,
  'mohammed bin rashid city':            22714,
  'mbr city':                            22714,
  'the springs':                          1490,
  'the meadows':                          1492,
  'the lakes':                            1494,
  'the greens':                           1493,
  'emirates hills':                       1488,
  'jumeirah lake towers':                  380,
  'jlt':                                   380,
  'al sufouh':                             370,
  'media city':                            371,
  'internet city':                         372,
  'knowledge village':                     374,
  'jumeirah golf estates':               22581,
};

// ── Main export: fetch live listings from Bayut ───────────────────────────────
export async function fetchBayutListings(params: {
  purpose:       'for-rent' | 'for-sale';
  propertyType?: string;
  area?:         string;
  bedsMin?:      number;
  bedsMax?:      number;
  priceMin?:     number;
  priceMax?:     number;
  limit?:        number;
}): Promise<Property[]> {

  if (!RAPIDAPI_KEY) {
    console.error('[bayutApi] RAPIDAPI_KEY not set');
    return [];
  }

  const catId  = CATEGORY_IDS[params.propertyType?.toLowerCase() || 'apartment'] ?? 4;
  const limit  = params.limit ?? 6;

  // Resolve location ID
  let locationId: number | undefined;
  if (params.area) {
    const key = params.area.toLowerCase().trim();
    locationId = LOCATION_CACHE[key];
    if (!locationId) locationId = await resolveLocationId(params.area);
  }

  const qp: Record<string, string> = {
    purpose:            params.purpose,
    categoryExternalID: String(catId),
    hitsPerPage:        String(limit),
    page:               '0',
    lang:               'en',
    sort:               'verified-score',
  };
  if (locationId        != null) qp.locationExternalID = String(locationId);
  if (params.bedsMin    != null) qp.bedsMin            = String(params.bedsMin);
  if (params.bedsMax    != null) qp.bedsMax            = String(params.bedsMax);
  if (params.priceMin)           qp.priceMin           = String(params.priceMin);
  if (params.priceMax)           qp.priceMax           = String(params.priceMax);

  try {
    const res = await axios.get(`https://${BAYUT_HOST}/properties/list`, {
      params: qp,
      headers: {
        'x-rapidapi-host': BAYUT_HOST,
        'x-rapidapi-key':  RAPIDAPI_KEY,
      },
      timeout: 15000,
    });

    const hits: unknown[] = res.data?.hits ?? [];
    console.log(`[bayutApi] ${hits.length} hits for ${JSON.stringify(qp)}`);
    return hits.map(h => mapHitToProperty(h as Record<string, unknown>));

  } catch (err: unknown) {
    const e = err as { response?: { status: number }; message?: string };
    if (e.response?.status === 403) {
      console.warn('[bayutApi] 403 — Bayut API not subscribed on this RapidAPI key');
    } else if (e.response?.status === 429) {
      console.warn('[bayutApi] 429 — RapidAPI rate limit hit');
    } else {
      console.error('[bayutApi] error:', e.message);
    }
    return [];
  }
}

// ── Resolve unknown area names via Bayut auto-complete ────────────────────────
async function resolveLocationId(area: string): Promise<number | undefined> {
  try {
    const res = await axios.get(`https://${BAYUT_HOST}/auto-complete`, {
      params: { query: area, hitsPerPage: '5', lang: 'en' },
      headers: {
        'x-rapidapi-host': BAYUT_HOST,
        'x-rapidapi-key':  RAPIDAPI_KEY,
      },
      timeout: 8000,
    });
    const hits: Record<string, unknown>[] = res.data?.hits ?? [];
    const areaLower = area.toLowerCase();
    const match = hits.find(h =>
      (h.name as string)?.toLowerCase().includes(areaLower) ||
      areaLower.includes((h.name as string)?.toLowerCase() ?? '')
    );
    if (match?.id) {
      const id = Number(match.id);
      LOCATION_CACHE[area.toLowerCase()] = id; // Cache for next time
      console.log(`[bayutApi] resolved "${area}" → locationId ${id}`);
      return id;
    }
  } catch { /* silent */ }
  return undefined;
}

// ── Map a Bayut API hit to our Property interface ─────────────────────────────
function mapHitToProperty(h: Record<string, unknown>): Property {
  const locArr = (h.location as Record<string, unknown>[] | undefined) ?? [];
  const area      = (locArr[locArr.length - 1] as Record<string, string>)?.name ?? '';
  const community = (locArr[locArr.length - 2] as Record<string, string>)?.name ?? '';

  const beds    = h.rooms != null ? Number(h.rooms) : 0;
  const bedsStr = beds === 0 ? 'studio' : String(beds);
  const price   = Number(h.price) ?? 0;
  const sqft    = Number(h.area)  ?? 0;
  const ppsf    = sqft > 0 ? Math.round(price / sqft) : 0;
  const isRent  = h.purpose === 'for-rent';

  // Build photo array: cover first, then rest
  const photos: string[] = [];
  const cover = (h.coverPhoto as Record<string, string> | undefined)?.url;
  if (cover) photos.push(cover);
  const photoList = (h.photos as Record<string, string>[] | undefined) ?? [];
  for (const ph of photoList) {
    if (ph.url && ph.url !== cover) photos.push(ph.url);
  }

  const daysOnMarket = h.createdAt
    ? Math.floor((Date.now() - new Date(h.createdAt as string).getTime()) / 86400000)
    : 0;

  const catName = ((h.category as Record<string, string>[])?.[0])?.name ?? 'Apartment';
  const agency  = (h.agency as Record<string, unknown> | undefined);

  return {
    id:                   String(h.externalID ?? h.id ?? ''),
    refNo:                String(h.externalID ?? h.id ?? ''),
    title:                String(h.title ?? `${bedsStr === 'studio' ? 'Studio' : bedsStr + 'BR'} in ${area}`),
    area,
    community,
    building:             '',
    propertyType:         catName,
    listingType:          isRent ? 'rent' : 'sale',
    bedrooms:             bedsStr,
    bathrooms:            Number(h.baths ?? 1),
    sqft,
    floor:                0,
    totalFloors:          0,
    view:                 '',
    price,
    pricePerSqft:         ppsf,
    serviceChargePerSqft: 0,
    chequesAccepted:      isRent ? 4 : 1,
    furnished:            h.furnishingStatus === 'furnished'
                            ? 'Furnished'
                            : h.furnishingStatus === 'unfurnished'
                              ? 'Unfurnished'
                              : 'Negotiable',
    amenities:            [],
    photoUrls:            photos,
    daysOnMarket,
    isGoldenVisaEligible: !isRent && price >= 2_000_000,
    grossYield:           0,
    isOffPlan:            false,
    developer:            String(agency?.name ?? ''),
    paymentPlan:          '',
    isFeatured:           Boolean(h.isVerified ?? false),
  };
}

// ── Helper: parse bedroom string from qualifying flow ─────────────────────────
export function parseBedsForBayut(bedrooms?: string): { bedsMin?: number; bedsMax?: number } {
  if (!bedrooms) return {};
  const b = bedrooms.toLowerCase().trim();
  if (b === 'studio') return { bedsMin: 0, bedsMax: 0 };
  const n = parseInt(b, 10);
  if (!isNaN(n)) return { bedsMin: n, bedsMax: n };
  // Handle "4+" or "4 or more"
  const plus = b.match(/^(\d+)\+/);
  if (plus) return { bedsMin: parseInt(plus[1], 10) };
  return {};
}

// ── Build a Bayut URL for a listing (for "View on Bayut" button) ──────────────
export function buildBayutUrl(externalId: string, purpose: string): string {
  return `https://www.bayut.com/property/details-${externalId}.html`;
}
