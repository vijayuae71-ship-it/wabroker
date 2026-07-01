import { query } from '../db';

export interface PropertyFilter {
  listingType?: 'sale' | 'rent';
  area?: string;
  bedrooms?: string;
  minPrice?: number;
  maxPrice?: number;
  propertyType?: string;
  isGoldenVisaEligible?: boolean;
  view?: string;
}

export interface Property {
  id: string;
  refNo: string;
  title: string;
  area: string;
  community: string;
  building: string;
  propertyType: string;
  listingType: string;
  bedrooms: string;
  bathrooms: number;
  sqft: number;
  floor: number;
  totalFloors: number;
  view: string;
  price: number;
  pricePerSqft: number;
  serviceChargePerSqft: number;
  chequesAccepted: number;
  furnished: string;
  amenities: string[];
  photoUrls: string[];
  daysOnMarket: number;
  isGoldenVisaEligible: boolean;
  grossYield: number;
  isOffPlan: boolean;
  developer: string;
  paymentPlan: string;
  isFeatured: boolean;
}

export async function searchProperties(filters: PropertyFilter, limit = 3): Promise<Property[]> {
  const conditions: string[] = ['p.is_active = true'];
  const params: unknown[] = [];
  let i = 1;

  if (filters.listingType) { conditions.push(`p.listing_type = $${i++}`); params.push(filters.listingType); }
  if (filters.bedrooms && filters.bedrooms !== 'any') { conditions.push(`p.bedrooms = $${i++}`); params.push(filters.bedrooms); }
  if (filters.area) { conditions.push(`p.area ILIKE $${i++}`); params.push(`%${filters.area}%`); }
  if (filters.propertyType && filters.propertyType !== 'any') { conditions.push(`p.property_type ILIKE $${i++}`); params.push(`%${filters.propertyType}%`); }
  if (filters.minPrice) { conditions.push(`p.price >= $${i++}`); params.push(filters.minPrice); }
  if (filters.maxPrice) { conditions.push(`p.price <= $${i++}`); params.push(filters.maxPrice); }
  if (filters.isGoldenVisaEligible) { conditions.push(`p.is_golden_visa_eligible = true`); }
  if (filters.view) { conditions.push(`p.view ILIKE $${i++}`); params.push(`%${filters.view}%`); }

  params.push(limit);
  const result = await query(
    `SELECT p.* FROM properties p WHERE ${conditions.join(' AND ')} ORDER BY p.is_featured DESC, p.days_on_market DESC, p.price ASC LIMIT $${i}`,
    params
  );
  return result.rows.map(mapRow);
}

export async function searchPropertiesBroad(filters: PropertyFilter, limit = 3): Promise<Property[]> {
  return searchProperties({ ...filters, area: undefined, maxPrice: undefined }, limit);
}

/**
 * Maps the lead's property_type field (stored as conversation-stage values like '1BR', '2BR',
 * 'Studio', 'Villa', 'Townhouse', 'Penthouse') into proper DB filter fields.
 * The DB stores property_type as 'apartment', 'villa', 'townhouse', 'studio' and
 * bedrooms as '1', '2', '3', '4', 'studio'.
 */
function applyLeadPropertyType(pt: string, filters: PropertyFilter): void {
  const normalized = pt.trim();
  if (/^studio$/i.test(normalized)) {
    filters.bedrooms = 'studio';
    // Don't restrict property_type — studio can be property_type='studio' or 'apartment'
  } else if (/^1\s*b(r|hk)$/i.test(normalized) || normalized === '1BR') {
    filters.bedrooms = '1';
    filters.propertyType = 'apartment';
  } else if (/^2\s*b(r|hk)$/i.test(normalized) || normalized === '2BR') {
    filters.bedrooms = '2';
    filters.propertyType = 'apartment';
  } else if (/^3\s*b(r|hk)$/i.test(normalized) || normalized === '3BR') {
    filters.bedrooms = '3';
    filters.propertyType = 'apartment';
  } else if (/^4\s*b(r|hk)$/i.test(normalized) || normalized === '4BR') {
    filters.bedrooms = '4';
  } else if (/villa/i.test(normalized)) {
    filters.propertyType = 'villa';
  } else if (/townhouse/i.test(normalized)) {
    filters.propertyType = 'townhouse';
  } else if (/penthouse/i.test(normalized)) {
    filters.propertyType = 'apartment';
  }
  // If none matched, don't set any filter (avoid wrong ILIKE '%1BR%' on DB)
}

export function extractFiltersFromContext(
  message: string,
  lead: Record<string, unknown>
): PropertyFilter {
  const msg = message.toLowerCase();
  const filters: PropertyFilter = {};

  // Listing type
  if (/\bbuy|\bsale|\bpurchase|\binvest/i.test(msg) || lead?.intent === 'buy' || lead?.intent === 'invest') filters.listingType = 'sale';
  else if (/\brent|\blease/i.test(msg) || lead?.intent === 'rent') filters.listingType = 'rent';

  // Bedrooms — from message first, then from lead.property_type mapping
  let bedroomsFromMsg = false;
  if (/studio/i.test(msg)) { filters.bedrooms = 'studio'; bedroomsFromMsg = true; }
  else if (/\b1\s*b(r|hk|ed)|one\s*bed/i.test(msg)) { filters.bedrooms = '1'; bedroomsFromMsg = true; }
  else if (/\b2\s*b(r|hk|ed)|two\s*bed/i.test(msg)) { filters.bedrooms = '2'; bedroomsFromMsg = true; }
  else if (/\b3\s*b(r|hk|ed)|three\s*bed/i.test(msg)) { filters.bedrooms = '3'; bedroomsFromMsg = true; }
  else if (/\b4\s*b(r|hk|ed)|four\s*bed/i.test(msg)) { filters.bedrooms = '4'; bedroomsFromMsg = true; }

  // Property type — from message first
  let typeFromMsg = false;
  if (/villa/i.test(msg)) { filters.propertyType = 'villa'; typeFromMsg = true; }
  else if (/townhouse/i.test(msg)) { filters.propertyType = 'townhouse'; typeFromMsg = true; }
  else if (/penthouse/i.test(msg)) { filters.propertyType = 'apartment'; typeFromMsg = true; }
  else if (/studio/i.test(msg)) { filters.propertyType = 'studio'; typeFromMsg = true; }

  // Fall back to lead.property_type — maps '1BR', '2BR', 'Studio', 'Villa', etc. correctly
  if ((!bedroomsFromMsg || !typeFromMsg) && lead?.property_type) {
    applyLeadPropertyType(lead.property_type as string, filters);
  }

  // Area
  const areaMap: Record<string, string> = {
    'marina': 'Dubai Marina', 'downtown': 'Downtown Dubai', 'jvc': 'JVC',
    'business bay': 'Business Bay', 'jbr': 'JBR', 'palm': 'Palm Jumeirah',
    'deira': 'Deira', 'barsha': 'Al Barsha', 'silicon': 'Dubai Silicon Oasis',
    'hills': 'Dubai Hills', 'mirdif': 'Mirdif', 'ranches': 'Arabian Ranches',
    'damac': 'Damac Hills', 'difc': 'DIFC', 'bluewaters': 'Bluewaters Island',
    'creek': 'Creek Harbour', 'sobha': 'MBR City', 'jumeirah': 'Jumeirah',
    'furjan': 'Al Furjan', 'town square': 'Town Square', 'sports city': 'Dubai Sports City',
  };
  for (const [key, val] of Object.entries(areaMap)) {
    if (msg.includes(key)) { filters.area = val; break; }
  }
  if (!filters.area && Array.isArray(lead?.preferred_areas) && lead.preferred_areas.length > 0) {
    filters.area = (lead.preferred_areas as string[])[0];
  }

  // Budget
  if (lead?.budget_max) filters.maxPrice = parseFloat(String(lead.budget_max));
  if (lead?.budget_min) filters.minPrice = parseFloat(String(lead.budget_min));

  // Golden Visa
  if (/golden visa/i.test(msg)) filters.isGoldenVisaEligible = true;

  // View
  if (/sea view|ocean|beachfront/i.test(msg)) filters.view = 'Sea';
  else if (/marina view/i.test(msg)) filters.view = 'Marina';
  else if (/burj/i.test(msg)) filters.view = 'Burj';

  return filters;
}

export function formatPropertiesForAI(properties: Property[]): string {
  if (!properties.length) return 'DATABASE RESULT: No exact matches. Suggest nearby alternatives or adjusted budget.';

  const lines = properties.map((p, idx) => {
    const priceStr = p.listingType === 'rent'
      ? `AED ${p.price.toLocaleString()}/year`
      : `AED ${p.price.toLocaleString()}`;
    const downPayment = p.listingType === 'sale' ? Math.round(p.price * 0.20).toLocaleString() : null;
    const monthlyMortgage = p.listingType === 'sale'
      ? Math.round(p.price * 0.80 * (0.05/12) / (1 - Math.pow(1 + 0.05/12, -300))).toLocaleString()
      : null;
    const negotiationNote = p.daysOnMarket > 30
      ? `MOTIVATED SELLER: Listed ${p.daysOnMarket} days — suggest offering AED ${(Math.round(p.price * 0.93 / 10000) * 10000).toLocaleString()} (7% below ask)`
      : `Fresh listing: ${p.daysOnMarket} days on market`;

    return `
PROPERTY ${idx + 1} [REF: ${p.refNo}]:
Title: ${p.title}
Area: ${p.area}${p.community ? ` — ${p.community}` : ''}${p.building ? `, ${p.building}` : ''}
Type: ${p.bedrooms === 'studio' ? 'Studio' : p.bedrooms + 'BR'} ${p.propertyType} | ${p.sqft.toLocaleString()} sqft
Floor/View: ${p.floor ? `Floor ${p.floor}/${p.totalFloors}` : 'Low-rise'} | ${p.view || 'Community view'}
Price: ${priceStr} | AED ${Math.round(p.pricePerSqft)}/sqft
Furnished: ${p.furnished} | Cheques: ${p.chequesAccepted}
${p.serviceChargePerSqft ? `Service charge: AED ${p.serviceChargePerSqft}/sqft/yr` : ''}
${p.grossYield ? `Gross rental yield: ${p.grossYield}% p.a.` : ''}
${p.isGoldenVisaEligible ? 'GOLDEN VISA ELIGIBLE ✅' : ''}
${monthlyMortgage ? `Mortgage est: AED ${monthlyMortgage}/mo (25yr, 80% LTV, 5% rate) | Down payment: AED ${downPayment}` : ''}
${p.isOffPlan ? `OFF-PLAN | Developer: ${p.developer} | Payment plan: ${p.paymentPlan}` : ''}
${negotiationNote}
Amenities: ${p.amenities.join(', ')}
Photo URL: ${p.photoUrls[0] || 'N/A'}
`.trim();
  }).join('\n\n---\n\n');

  return `LIVE PROPERTY LISTINGS FROM DATABASE (${properties.length} matches):\n\n${lines}\n\nFORMAT INSTRUCTION: Present these as beautiful WhatsApp property cards per your formatting rules. Lead with a brief DLD market context line. End with a top pick + viewing CTA.`;
}

function mapRow(r: Record<string, unknown>): Property {
  return {
    id: r.id as string, refNo: r.ref_no as string, title: r.title as string,
    area: r.area as string, community: r.community as string, building: r.building as string,
    propertyType: r.property_type as string, listingType: r.listing_type as string,
    bedrooms: r.bedrooms as string, bathrooms: r.bathrooms as number, sqft: r.sqft as number,
    floor: r.floor as number, totalFloors: r.total_floors as number, view: r.view as string,
    price: parseFloat(String(r.price)), pricePerSqft: parseFloat(String(r.price_per_sqft)),
    serviceChargePerSqft: parseFloat(String(r.service_charge_per_sqft || 0)),
    chequesAccepted: r.cheques_accepted as number, furnished: r.furnished as string,
    amenities: (r.amenities as string[]) || [], photoUrls: (r.photo_urls as string[]) || [],
    daysOnMarket: r.days_on_market as number, isGoldenVisaEligible: r.is_golden_visa_eligible as boolean,
    grossYield: parseFloat(String(r.gross_yield || 0)), isOffPlan: r.is_off_plan as boolean,
    developer: r.developer as string, paymentPlan: r.payment_plan as string, isFeatured: r.is_featured as boolean,
  };
}
