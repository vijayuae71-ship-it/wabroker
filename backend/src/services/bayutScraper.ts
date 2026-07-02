/**
 * bayutScraper.ts — Scrapes live listings directly from Bayut.com
 *
 * Bayut is a Next.js app — all listing data is embedded as __NEXT_DATA__ JSON
 * in every search results page. No API key required. Always fresh.
 *
 * Returns the same Property interface as bayutApi.ts so liveListings.ts
 * can use either source transparently.
 */

import { Property } from './propertyService';

// ── Area slug map ─────────────────────────────────────────────────────────────
const AREA_SLUGS: Record<string, string> = {
  'dubai marina':               'dubai-marina',
  'marina':                     'dubai-marina',
  'downtown dubai':             'downtown-dubai',
  'downtown':                   'downtown-dubai',
  'business bay':               'business-bay',
  'jumeirah village circle':    'jumeirah-village-circle',
  'jvc':                        'jumeirah-village-circle',
  'deira':                      'deira',
  'bur dubai':                  'bur-dubai',
  'al mankool':                 'bur-dubai',
  'al barsha':                  'al-barsha',
  'barsha':                     'al-barsha',
  'jbr':                        'jumeirah-beach-residence',
  'jumeirah beach residence':   'jumeirah-beach-residence',
  'dubai hills':                'dubai-hills-estate',
  'dubai hills estate':         'dubai-hills-estate',
  'palm jumeirah':              'palm-jumeirah',
  'palm':                       'palm-jumeirah',
  'arabian ranches':            'arabian-ranches',
  'al karama':                  'al-karama',
  'international city':         'international-city',
  'ritaj':                      'ritaj-international-city',
  'silicon oasis':              'dubai-silicon-oasis',
  'dubai silicon oasis':        'dubai-silicon-oasis',
  'dso':                        'dubai-silicon-oasis',
  'discovery gardens':          'discovery-gardens',
  'motor city':                 'motor-city',
  'arjan':                      'arjan',
  'town square':                'town-square',
  'dubai south':                'dubai-south',
  'mirdif':                     'mirdif',
  'al nahda':                   'al-nahda',
  'barsha heights':             'barsha-heights',
  'tecom':                      'barsha-heights',
  'damac hills':                'damac-hills',
  'jumeirah village triangle':  'jumeirah-village-triangle',
  'jvt':                        'jumeirah-village-triangle',
  'creek harbour':              'dubai-creek-harbour',
  'dubai creek harbour':        'dubai-creek-harbour',
  'difc':                       'difc',
  'jumeirah':                   'jumeirah',
  'bluewaters':                 'bluewaters-island',
  'bluewaters island':          'bluewaters-island',
  'al furjan':                  'al-furjan',
  'remraam':                    'remraam',
  'dubailand':                  'dubailand',
  'dubai sports city':          'dubai-sports-city',
  'sports city':                'dubai-sports-city',
  'al quoz':                    'al-quoz',
  'meydan':                     'meydan',
  'sobha hartland':             'sobha-hartland',
  'the springs':                'the-springs',
  'the meadows':                'the-meadows',
  'the lakes':                  'the-lakes',
  'the greens':                 'the-greens',
  'emirates hills':             'emirates-hills',
  'jumeirah lake towers':       'jumeirah-lake-towers',
  'jlt':                        'jumeirah-lake-towers',
  'media city':                 'dubai-media-city',
  'internet city':              'dubai-internet-city',
};

// ── Property type → Bayut URL slug ────────────────────────────────────────────
const TYPE_SLUGS: Record<string, string> = {
  apartment:  'apartments',
  flat:       'apartments',
  studio:     'apartments',
  villa:      'villas',
  townhouse:  'townhouses',
  penthouse:  'penthouses',
  duplex:     'apartments',
  office:     'offices',
};

// ── Build Bayut search URL ─────────────────────────────────────────────────────
function buildBayutUrl(params: {
  purpose:       'for-rent' | 'for-sale';
  propertyType?: string;
  area?:         string;
  bedsMin?:      number;
  priceMin?:     number;
  priceMax?:     number;
}): string {
  const purposeSlug = params.purpose === 'for-rent' ? 'to-rent' : 'for-sale';
  const typeSlug    = TYPE_SLUGS[params.propertyType?.toLowerCase() || 'apartment'] ?? 'apartments';

  let areaSlug = 'dubai';
  if (params.area) {
    const key = params.area.toLowerCase().trim();
    areaSlug = AREA_SLUGS[key] ?? key.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  let url = `https://www.bayut.com/${purposeSlug}/${typeSlug}/${areaSlug}/`;

  const qp: string[] = [];
  if (params.bedsMin != null)  qp.push(`beds_min=${params.bedsMin}`);
  if (params.priceMin)         qp.push(`price_min=${params.priceMin}`);
  if (params.priceMax)         qp.push(`price_max=${params.priceMax}`);
  if (qp.length > 0) url += '?' + qp.join('&');

  return url;
}

// ── Map a Bayut listing hit to Property ───────────────────────────────────────
function mapHit(h: Record<string, unknown>, purpose: 'for-rent' | 'for-sale'): Property | null {
  try {
    const externalID = String(h.externalID ?? h.id ?? '');
    if (!externalID) return null;

    const price  = Number(h.price) || 0;
    const rooms  = h.rooms != null ? Number(h.rooms) : 0;
    const area   = Number(h.area) || 0;
    const ppsf   = area > 0 ? Math.round(price / area) : 0;
    const isRent = purpose === 'for-rent';

    // Location
    const locArr = (h.location as Record<string, unknown>[] | undefined) ?? [];
    const areaName     = (locArr[locArr.length - 1] as Record<string, string>)?.name ?? '';
    const community    = (locArr[locArr.length - 2] as Record<string, string>)?.name ?? '';

    // Photos
    const photos: string[] = [];
    const cover = (h.coverPhoto as Record<string, string> | undefined)?.url;
    if (cover) photos.push(cover);
    const photoList = (h.photos as Record<string, string>[] | undefined) ?? [];
    for (const ph of photoList) {
      if (ph.url && ph.url !== cover) photos.push(ph.url);
    }

    // Agency
    const agency = (h.agency as Record<string, unknown> | undefined);

    const bedsStr = rooms === 0 ? 'studio' : String(rooms);
    const catName = ((h.category as Record<string, string>[])?.[0])?.name ?? 'Apartment';

    return {
      id:           externalID,
      refNo:        externalID,
      title:        String(h.title ?? `${bedsStr === 'studio' ? 'Studio' : bedsStr + 'BR'} ${catName} in ${areaName}`),
      area:         areaName,
      community:    community,
      building:     '',
      bedrooms:     bedsStr,
      bathrooms:    Number(h.baths) || 0,
      sqft:         area,
      floor:        0,
      totalFloors:  0,
      view:         '',
      price:        price,
      pricePerSqft: ppsf,
      serviceChargePerSqft: 0,
      chequesAccepted: 0,
      furnished:    '',
      propertyType: catName,
      listingType:  isRent ? 'rent' : 'sale',
      description:  String(h.description ?? ''),
      amenities:    [],
      photoUrls:    photos,
      agentName:    String((agency?.name as string) ?? 'Dubai RE Agency'),
      agencyName:   String((agency?.name as string) ?? 'Dubai RE Agency'),
      agencyLogo:   String((agency?.logo as Record<string,string>)?.url ?? ''),
      sourceUrl:    `https://www.bayut.com/property/details-${externalID}.html`,
      source:       'bayut',
      isGoldenVisaEligible: false,
      grossYield:   0,
      isOffPlan:    false,
      developer:    '',
      paymentPlan:  '',
      isFeatured:   false,
      daysOnMarket: h.createdAt
        ? Math.floor((Date.now() - new Date(h.createdAt as string).getTime()) / 86400000)
        : 0,
    } as unknown as Property;
  } catch {
    return null;
  }
}

// ── Main export: scrape live listings from Bayut.com ─────────────────────────
export async function scrapeBayutListings(params: {
  purpose:       'for-rent' | 'for-sale';
  propertyType?: string;
  area?:         string;
  bedsMin?:      number;
  bedsMax?:      number;
  priceMin?:     number;
  priceMax?:     number;
  limit?:        number;
}): Promise<Property[]> {

  const limit = params.limit ?? 6;
  const url   = buildBayutUrl(params);
  console.log(`[bayutScraper] GET ${url}`);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control':   'no-cache',
        'Pragma':          'no-cache',
      },
    });
    clearTimeout(timer);

    if (!res.ok) {
      console.warn(`[bayutScraper] HTTP ${res.status} for ${url}`);
      return [];
    }

    const html = await res.text();

    // Extract __NEXT_DATA__ JSON (Bayut is Next.js)
    const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (!match) {
      console.warn('[bayutScraper] __NEXT_DATA__ not found — trying JSON-LD fallback');
      return scrapeJsonLdFallback(html, params.purpose, limit);
    }

    const nextData = JSON.parse(match[1]);

    // Path: pageProps.searchResult.hits  OR  pageProps.hits
    const searchResult =
      nextData?.props?.pageProps?.searchResult ??
      nextData?.props?.pageProps ??
      {};

    const hits: Record<string, unknown>[] =
      searchResult.hits ??
      searchResult.properties ??
      searchResult.results ??
      [];

    console.log(`[bayutScraper] ${hits.length} raw hits from __NEXT_DATA__`);

    if (hits.length === 0) {
      // Try alternative path
      const altHits = extractHitsDeep(nextData);
      console.log(`[bayutScraper] deep search found ${altHits.length} hits`);
      const props = altHits
        .map(h => mapHit(h, params.purpose))
        .filter(Boolean) as Property[];
      return applyFilters(props, params, limit);
    }

    const props = hits
      .map(h => mapHit(h, params.purpose))
      .filter(Boolean) as Property[];

    return applyFilters(props, params, limit);

  } catch (err: unknown) {
    const e = err as { message?: string; name?: string };
    if (e.name === 'AbortError') {
      console.warn('[bayutScraper] timeout');
    } else {
      console.error('[bayutScraper] error:', e.message);
    }
    return [];
  }
}

// ── Deep search for hits array anywhere in Next.js data ──────────────────────
function extractHitsDeep(obj: unknown, depth = 0): Record<string, unknown>[] {
  if (depth > 8 || !obj || typeof obj !== 'object') return [];
  const o = obj as Record<string, unknown>;

  // Look for arrays that look like property listings
  for (const key of ['hits', 'properties', 'listings', 'results', 'data']) {
    if (Array.isArray(o[key]) && (o[key] as unknown[]).length > 0) {
      const arr = o[key] as Record<string, unknown>[];
      // Check first item looks like a property (has price and externalID)
      if (arr[0] && (arr[0].price || arr[0].externalID || arr[0].title)) {
        return arr;
      }
    }
  }

  for (const val of Object.values(o)) {
    const found = extractHitsDeep(val, depth + 1);
    if (found.length > 0) return found;
  }
  return [];
}

// ── JSON-LD fallback: parse schema.org RealEstateListing items ────────────────
function scrapeJsonLdFallback(
  html: string,
  purpose: 'for-rent' | 'for-sale',
  limit: number
): Property[] {
  const props: Property[] = [];
  const ldMatches = html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
  for (const m of ldMatches) {
    try {
      const ld = JSON.parse(m[1]);
      if (ld['@type'] === 'RealEstateListing' || ld['@type'] === 'Apartment') {
        const price = Number(String(ld.offers?.price ?? ld.price ?? '0').replace(/[^0-9]/g, '')) || 0;
        if (!price) continue;
        const bedsNum = Number(ld.numberOfBedrooms) || 0;
        props.push({
          id:           String(ld.identifier ?? Math.random()),
          refNo:        String(ld.identifier ?? ''),
          title:        String(ld.name ?? ''),
          area:         String(ld.address?.addressLocality ?? ''),
          community:    '',
          building:     '',
          bedrooms:     bedsNum === 0 ? 'studio' : String(bedsNum),
          bathrooms:    Number(ld.numberOfBathroomsTotal) || 0,
          sqft:         Number(ld.floorSize?.value) || 0,
          floor:        0,
          totalFloors:  0,
          view:         '',
          price,
          pricePerSqft: 0,
          serviceChargePerSqft: 0,
          chequesAccepted: 0,
          furnished:    '',
          propertyType: 'Apartment',
          listingType:  purpose === 'for-rent' ? 'rent' : 'sale',
          description:  String(ld.description ?? ''),
          amenities:    [],
          photoUrls:    ld.image ? [String(ld.image)] : [],
          agentName:    'Dubai RE Agency',
          agencyName:   'Dubai RE Agency',
          agencyLogo:   '',
          sourceUrl:    String(ld.url ?? ''),
          source:       'bayut',
          isGoldenVisaEligible: false,
          grossYield:   0,
          isOffPlan:    false,
          developer:    '',
          paymentPlan:  '',
          isFeatured:   false,
          daysOnMarket: 0,
        } as unknown as Property);
        if (props.length >= limit) break;
      }
    } catch { /* skip */ }
  }
  return props;
}

// ── Apply bed/price filters and limit ────────────────────────────────────────
function applyFilters(
  props: Property[],
  params: { bedsMin?: number; bedsMax?: number; priceMin?: number; priceMax?: number },
  limit: number
): Property[] {
  return props
    .filter(p => {
      const bedsNum = p.bedrooms === 'studio' ? 0 : parseInt(String(p.bedrooms), 10);
      if (params.bedsMin != null && bedsNum < params.bedsMin) return false;
      if (params.bedsMax != null && bedsNum > params.bedsMax) return false;
      if (params.priceMin && p.price < params.priceMin * 0.8) return false;
      if (params.priceMax && p.price > params.priceMax * 1.2) return false;
      return true;
    })
    .slice(0, limit);
}
