/**
 * propertyFinderApi.ts — Live property listings from PropertyFinder via RapidAPI
 *
 * Host: propertyfinder-ae.p.rapidapi.com
 * Uses the same RAPIDAPI_KEY as Bayut.
 */

import axios from 'axios';
import { Property } from './propertyService';

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '';
const PF_HOST      = 'propertyfinder-ae.p.rapidapi.com';

// ── Bedroom mapping ────────────────────────────────────────────────────────────
function bedsParam(bedrooms?: string): string | undefined {
  if (!bedrooms) return undefined;
  const b = bedrooms.toLowerCase().trim();
  if (b === 'studio') return '0';
  const n = parseInt(b, 10);
  if (!isNaN(n)) return String(n);
  const plus = b.match(/^(\d+)\+/);
  if (plus) return `${plus[1]}+`;
  return undefined;
}

// ── Purpose mapping ────────────────────────────────────────────────────────────
function purposeParam(intent?: string): string {
  if (!intent) return 'rent';
  const i = intent.toLowerCase();
  if (i.includes('buy') || i.includes('sale') || i.includes('purchase')) return 'sale';
  return 'rent';
}

// ── Category mapping ───────────────────────────────────────────────────────────
function categoryParam(propertyType?: string): string {
  if (!propertyType) return 'AP'; // Apartment default
  const p = propertyType.toLowerCase();
  if (p.includes('villa'))      return 'VH';
  if (p.includes('townhouse'))  return 'TH';
  if (p.includes('penthouse'))  return 'PH';
  if (p.includes('studio'))     return 'AP';
  return 'AP';
}

// ── Map a PropertyFinder hit to our Property interface ─────────────────────────
function mapPFHit(h: Record<string, unknown>): Property {
  const price  = Number(h.price ?? h.rent ?? 0);
  const sqft   = Number(h.size ?? h.area_sqft ?? 0);
  const ppsf   = sqft > 0 ? Math.round(price / sqft) : 0;
  const isRent = purposeParam(h.purpose as string) === 'rent';

  const beds    = h.bedrooms != null ? Number(h.bedrooms) : 0;
  const bedsStr = beds === 0 ? 'studio' : String(beds);

  // Photos
  const photos: string[] = [];
  const cover = (h.cover_photo as string | undefined) ||
                (h.thumbnail as string | undefined);
  if (cover) photos.push(cover);
  const gallery = (h.photos as string[] | undefined) ?? [];
  for (const p of gallery) {
    if (p && p !== cover) photos.push(p);
  }

  const areaName  = String(h.community ?? h.area ?? h.location ?? '');
  const titleStr  = String(h.title ?? `${bedsStr === 'studio' ? 'Studio' : bedsStr + 'BR'} in ${areaName}`);
  const daysOnMkt = h.listed_at
    ? Math.floor((Date.now() - new Date(h.listed_at as string).getTime()) / 86400000)
    : 0;

  return {
    id:                   String(h.id ?? h.reference ?? ''),
    refNo:                String(h.reference ?? h.id ?? ''),
    title:                titleStr,
    area:                 areaName,
    community:            String(h.sub_community ?? ''),
    building:             String(h.building ?? ''),
    propertyType:         String(h.category ?? h.type ?? 'Apartment'),
    listingType:          isRent ? 'rent' : 'sale',
    bedrooms:             bedsStr,
    bathrooms:            Number(h.bathrooms ?? 1),
    sqft,
    floor:                0,
    totalFloors:          0,
    view:                 '',
    price,
    pricePerSqft:         ppsf,
    serviceChargePerSqft: 0,
    chequesAccepted:      isRent ? 4 : 1,
    furnished:            h.furnished ? 'Furnished' : 'Unfurnished',
    amenities:            [],
    photoUrls:            photos,
    daysOnMarket:         daysOnMkt,
    isGoldenVisaEligible: !isRent && price >= 2_000_000,
    grossYield:           0,
    isOffPlan:            false,
    developer:            String((h.agent as Record<string,string>)?.agency ?? ''),
    paymentPlan:          '',
    isFeatured:           false,
    source:               'propertyfinder',
    sourceUrl:            String(h.url ?? h.link ?? ''),
  } as Property & { source: string; sourceUrl: string };
}

// ── Main export ────────────────────────────────────────────────────────────────
export interface LiveSearchFilters {
  intent?:        string;
  propertyType?:  string;
  area?:          string;
  budgetMin?:     number;
  budgetMax?:     number;
  bedrooms?:      string;
}

export async function fetchFromPropertyFinder(
  filters: LiveSearchFilters,
  limit = 5
): Promise<Property[]> {
  if (!RAPIDAPI_KEY) {
    console.warn('[propertyFinderApi] RAPIDAPI_KEY not set');
    return [];
  }

  try {
    const params: Record<string, string | number> = {
      purpose:    purposeParam(filters.intent),
      // location query — PF uses free-text location search
      location:   filters.area ?? 'Dubai',
      size:       limit,
      page:       1,
    };

    if (filters.budgetMin) params.price_min = filters.budgetMin;
    if (filters.budgetMax) params.price_max = filters.budgetMax;

    const beds = bedsParam(filters.bedrooms);
    if (beds !== undefined) params.bedrooms = beds;

    const category = categoryParam(filters.propertyType);
    params.category = category;

    const resp = await axios.get('https://propertyfinder-ae.p.rapidapi.com/properties', {
      params,
      headers: {
        'x-rapidapi-host': PF_HOST,
        'x-rapidapi-key':  RAPIDAPI_KEY,
      },
      timeout: 8000,
    });

    const data = resp.data;

    // Handle various response shapes
    let hits: Record<string, unknown>[] = [];
    if (Array.isArray(data))              hits = data;
    else if (Array.isArray(data?.data))   hits = data.data;
    else if (Array.isArray(data?.properties)) hits = data.properties;
    else if (Array.isArray(data?.results))    hits = data.results;

    console.log(`[propertyFinderApi] ${hits.length} hits for ${JSON.stringify(params)}`);

    return hits
      .slice(0, limit)
      .map(h => mapPFHit(h))
      .filter(p => p.price > 0);

  } catch (e: unknown) {
    const err = e as { response?: { status: number }; message: string };
    if (err.response?.status === 403) {
      console.warn('[propertyFinderApi] 403 — PropertyFinder API not subscribed on this key');
    } else if (err.response?.status === 429) {
      console.warn('[propertyFinderApi] 429 — rate limit');
    } else {
      console.warn('[propertyFinderApi] error:', err.message);
    }
    return [];
  }
}
