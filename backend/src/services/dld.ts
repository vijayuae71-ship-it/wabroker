import axios from 'axios';

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '';
const RAPIDAPI_HOST = 'uae-real-estate-data-api1.p.rapidapi.com';
const BASE_URL = `https://${RAPIDAPI_HOST}`;

const headers = () => ({
  'x-rapidapi-host': RAPIDAPI_HOST,
  'x-rapidapi-key': RAPIDAPI_KEY,
  'Content-Type': 'application/json',
});

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DLDTransaction {
  id: string;
  bedrooms: number;
  price: number;
  price_per_sqft: number;
  property_size: number;
  property_type: string;
  location_name: string;
  high_level_location_name: string;
  transaction_date: string;
  status: string;
  contract_start_date?: string;
  contract_end_date?: string;
}

export interface TransactionSummary {
  rent_new_avg_price: number | null;
  rent_renew_avg_price: number | null;
  roi: number | null;
  sale_avg_price: number | null;
  sale_avg_price_per_sqft: number | null;
  sale_avg_price_change: number | null;
  sale_avg_price_per_sqft_change: number | null;
  volume: number | null;
}

export interface Listing {
  property_id: string;
  title: string;
  price: number;
  beds: string;
  size: number;
  area: string;
  verified: boolean;
  property_type: string;
  property_url: string;
  listed_date: string;
}

export interface MarketData {
  listings: Listing[];
  transactions: DLDTransaction[];
  summary: TransactionSummary | null;
  total_listings: number;
  total_transactions: number;
  negotiation_brief: NegotiationBrief;
}

export interface NegotiationBrief {
  asking_avg: number;
  dld_avg: number;
  gap_pct: number;
  gap_aed: number;
  new_vs_renewal_gap: number | null;
  roi: number | null;
  trend: 'rising' | 'stable' | 'falling';
  insight: string;
  layla_message: string;
}

// ─── Core API Calls ───────────────────────────────────────────────────────────

export async function searchRentListings(params: {
  location_id?: number;
  beds?: number | string;
  price_min?: number;
  price_max?: number;
  page?: number;
}): Promise<{ listings: Listing[]; total: number }> {
  try {
    const queryParams: Record<string, string> = { page: String(params.page || 1) };
    if (params.location_id) queryParams.location_id = String(params.location_id);
    if (params.beds !== undefined) queryParams.beds = String(params.beds);
    if (params.price_min) queryParams.price_min = String(params.price_min);
    if (params.price_max) queryParams.price_max = String(params.price_max);

    const qs = new URLSearchParams(queryParams).toString();
    const res = await axios.get(`${BASE_URL}/search-rent?${qs}`, { headers: headers() });
    const data = res.data;

    if (!data.success) return { listings: [], total: 0 };

    const listings: Listing[] = (data.data || []).map((p: any) => ({
      property_id: p.property_id,
      title: p.title || '',
      price: p.price?.value || 0,
      beds: p.bedrooms || 'studio',
      size: p.size?.value || 0,
      area: p.address?.full_name || '',
      verified: p.is_verified || false,
      property_type: p.property_type || 'Apartment',
      property_url: p.property_url || '',
      listed_date: p.listed_date || '',
    }));

    return { listings, total: data.total_count || 0 };
  } catch (err) {
    console.error('searchRentListings error:', err);
    return { listings: [], total: 0 };
  }
}

export async function getTransactions(params: {
  transaction_type: 'sold' | 'rented';
  location_id?: number;
  beds?: number;
  page?: number;
}): Promise<{ transactions: DLDTransaction[]; summary: TransactionSummary | null; total: number }> {
  try {
    const queryParams: Record<string, string> = {
      transaction_type: params.transaction_type,
      page: String(params.page || 1),
    };
    if (params.location_id) queryParams.location_id = String(params.location_id);
    if (params.beds !== undefined) queryParams.beds = String(params.beds);

    const qs = new URLSearchParams(queryParams).toString();
    const res = await axios.get(`${BASE_URL}/get-transactions?${qs}`, { headers: headers() });
    const data = res.data;

    if (!data.success) return { transactions: [], summary: null, total: 0 };

    const attrs = data.data?.data?.attributes;
    const summary: TransactionSummary = attrs?.summary || null;
    const txList: DLDTransaction[] = (attrs?.transactions || []).map((t: any) => ({
      id: t.id,
      bedrooms: t.bedrooms,
      price: t.price,
      price_per_sqft: t.price_per_sqft,
      property_size: t.property_size,
      property_type: t.property_type,
      location_name: t.location_name,
      high_level_location_name: t.high_level_location_name,
      transaction_date: t.transaction_date,
      status: t.status,
      contract_start_date: t.contract_start_date,
      contract_end_date: t.contract_end_date,
    }));

    return {
      transactions: txList,
      summary,
      total: attrs?.total_items || 0,
    };
  } catch (err) {
    console.error('getTransactions error:', err);
    return { transactions: [], summary: null, total: 0 };
  }
}

export async function getPropertyDetails(property_id: string): Promise<any> {
  try {
    const res = await axios.get(`${BASE_URL}/property-details?property_id=${property_id}`, {
      headers: headers(),
    });
    return res.data?.data?.property || null;
  } catch (err) {
    console.error('getPropertyDetails error:', err);
    return null;
  }
}

// ─── Smart Market Query ───────────────────────────────────────────────────────

/**
 * Main function: given a natural-language query, returns full market data
 * including live listings + DLD transaction data + negotiation brief.
 */
export async function getMarketData(params: {
  beds?: number | string;
  price_max?: number;
  location_id?: number;
  purpose?: 'rent' | 'buy';
}): Promise<MarketData> {
  const purpose = params.purpose || 'rent';
  const txType = purpose === 'rent' ? 'rented' : 'sold';
  const bedsNum = params.beds !== undefined ? Number(params.beds) : undefined;

  // Fetch listings + transactions in parallel
  const [listingsResult, txResult] = await Promise.all([
    purpose === 'rent'
      ? searchRentListings({
          location_id: params.location_id,
          beds: params.beds,
          price_max: params.price_max,
        })
      : Promise.resolve({ listings: [] as Listing[], total: 0 }),
    getTransactions({
      transaction_type: txType,
      location_id: params.location_id,
      beds: bedsNum,
    }),
  ]);

  const { listings, total: total_listings } = listingsResult;
  const { transactions, summary, total: total_transactions } = txResult;

  // Build negotiation brief
  const negotiation_brief = buildNegotiationBrief(listings, transactions, summary, purpose);

  return {
    listings: listings.slice(0, 10), // top 10 for Layla
    transactions: transactions.slice(0, 5), // sample DLD records
    summary,
    total_listings,
    total_transactions,
    negotiation_brief,
  };
}

// ─── Negotiation Brief Builder ────────────────────────────────────────────────

function buildNegotiationBrief(
  listings: Listing[],
  transactions: DLDTransaction[],
  summary: TransactionSummary | null,
  purpose: 'rent' | 'buy'
): NegotiationBrief {
  // Asking price average from live listings
  const prices = listings.map((l) => l.price).filter((p) => p > 0);
  const asking_avg = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;

  // DLD actual average
  let dld_avg = 0;
  if (purpose === 'rent' && summary?.rent_new_avg_price) {
    dld_avg = summary.rent_new_avg_price;
  } else if (purpose === 'buy' && summary?.sale_avg_price) {
    dld_avg = summary.sale_avg_price;
  } else if (transactions.length > 0) {
    const txPrices = transactions.map((t) => t.price).filter((p) => p > 0);
    dld_avg = txPrices.length > 0 ? txPrices.reduce((a, b) => a + b, 0) / txPrices.length : 0;
  }

  const gap_aed = asking_avg > 0 && dld_avg > 0 ? asking_avg - dld_avg : 0;
  const gap_pct = dld_avg > 0 && gap_aed !== 0 ? (gap_aed / dld_avg) * 100 : 0;

  // New vs renewal gap (rental only)
  const new_vs_renewal_gap =
    summary?.rent_new_avg_price && summary?.rent_renew_avg_price
      ? summary.rent_new_avg_price - summary.rent_renew_avg_price
      : null;

  // Price trend
  const change = purpose === 'buy' ? summary?.sale_avg_price_change : summary?.volume;
  const trend: 'rising' | 'stable' | 'falling' =
    change === null || change === undefined
      ? 'stable'
      : change > 2
      ? 'rising'
      : change < -2
      ? 'falling'
      : 'stable';

  const trendEmoji = trend === 'rising' ? '📈' : trend === 'falling' ? '📉' : '➡️';

  // Build insight text
  let insight = '';
  if (gap_pct > 3) {
    insight = `Asking prices are ${gap_pct.toFixed(1)}% above DLD registered prices — use this as leverage.`;
  } else if (gap_pct < -3) {
    insight = `Asking prices are ${Math.abs(gap_pct).toFixed(1)}% below DLD average — good value, act fast.`;
  } else {
    insight = 'Asking prices are in line with DLD registered transactions.';
  }

  if (new_vs_renewal_gap && new_vs_renewal_gap > 5000) {
    insight += ` New contracts average AED ${Math.round(new_vs_renewal_gap).toLocaleString()} more than renewals — landlords have room to negotiate.`;
  }

  // Layla message (WhatsApp ready)
  const formatAED = (n: number) =>
    n >= 1_000_000
      ? `AED ${(n / 1_000_000).toFixed(2)}M`
      : `AED ${Math.round(n).toLocaleString()}`;

  let laylaMsg = `📊 *Live Market Data — DLD Verified*\n\n`;

  if (purpose === 'rent') {
    laylaMsg += `🏠 *Rental Market Overview*\n`;
    if (summary?.rent_new_avg_price)
      laylaMsg += `• New contract avg: *${formatAED(summary.rent_new_avg_price)}*\n`;
    if (summary?.rent_renew_avg_price)
      laylaMsg += `• Renewal avg: *${formatAED(summary.rent_renew_avg_price)}*\n`;
    if (new_vs_renewal_gap && new_vs_renewal_gap > 0)
      laylaMsg += `• New vs renewal gap: *${formatAED(new_vs_renewal_gap)}* — landlords price new tenants higher 💡\n`;
  } else {
    laylaMsg += `🏢 *Sales Market Overview*\n`;
    if (summary?.sale_avg_price)
      laylaMsg += `• Avg sale price: *${formatAED(summary.sale_avg_price)}*\n`;
    if (summary?.sale_avg_price_per_sqft)
      laylaMsg += `• Avg price/sqft: *AED ${Math.round(summary.sale_avg_price_per_sqft).toLocaleString()}*\n`;
    if (summary?.roi) laylaMsg += `• Rental yield (ROI): *${summary.roi.toFixed(1)}%* 📈\n`;
    if (summary?.sale_avg_price_change)
      laylaMsg += `• Price change: *${summary.sale_avg_price_change > 0 ? '+' : ''}${summary.sale_avg_price_change.toFixed(1)}%* ${trendEmoji}\n`;
  }

  if (asking_avg > 0 && dld_avg > 0) {
    laylaMsg += `\n💡 *Negotiation Insight*\n`;
    laylaMsg += `• Listed avg: *${formatAED(asking_avg)}*\n`;
    laylaMsg += `• DLD actual avg: *${formatAED(dld_avg)}*\n`;
    if (Math.abs(gap_pct) > 1) {
      laylaMsg += `• Gap: *${gap_pct > 0 ? '+' : ''}${gap_pct.toFixed(1)}%* (${formatAED(Math.abs(gap_aed))})\n`;
    }
    laylaMsg += `\n_${insight}_`;
  } else {
    laylaMsg += `\n_${insight}_`;
  }

  return {
    asking_avg,
    dld_avg,
    gap_pct,
    gap_aed,
    new_vs_renewal_gap,
    roi: summary?.roi || null,
    trend,
    insight,
    layla_message: laylaMsg,
  };
}

// ─── Quick NL Search (called by AI conversation handler) ─────────────────────

export async function quickMarketSearch(query: string): Promise<string> {
  const q = query.toLowerCase();

  // Parse intent
  const purpose: 'rent' | 'buy' = q.includes('buy') || q.includes('sale') || q.includes('invest')
    ? 'buy'
    : 'rent';

  // Parse beds
  let beds: number | undefined;
  const bedsMatch = q.match(/(\d)\s*(bed|br|bhk)/);
  if (bedsMatch) beds = parseInt(bedsMatch[1]);
  else if (q.includes('studio')) beds = 0;

  // Parse price
  let price_max: number | undefined;
  const priceMatch = q.match(/under\s+(?:aed\s*)?(\d+)k?/);
  if (priceMatch) {
    const raw = parseInt(priceMatch[1]);
    price_max = priceMatch[0].includes('k') || raw < 1000 ? raw * 1000 : raw;
  }

  // Location ID mapping (Dubai = 1 as default)
  const locationMap: Record<string, number> = {
    dubai: 1,
    'abu dhabi': 2,
    sharjah: 3,
    ajman: 4,
    'ras al khaimah': 5,
    fujairah: 6,
    'umm al quwain': 7,
  };
  let location_id = 1;
  for (const [name, id] of Object.entries(locationMap)) {
    if (q.includes(name)) { location_id = id; break; }
  }

  const data = await getMarketData({ beds, price_max, location_id, purpose });

  let response = data.negotiation_brief.layla_message;

  // Add top listings
  if (data.listings.length > 0) {
    response += `\n\n🔍 *Top Listings Found (${data.total_listings.toLocaleString()} total)*\n`;
    data.listings.slice(0, 5).forEach((l, i) => {
      const verified = l.verified ? '✅' : '';
      response += `\n${i + 1}. ${verified} *${l.title}*\n`;
      response += `   📍 ${l.area}\n`;
      response += `   💰 AED ${l.price.toLocaleString()}/yr`;
      if (l.size) response += ` | 📐 ${l.size} sqft`;
      response += '\n';
    });
  }

  if (data.total_transactions > 0) {
    response += `\n_Based on ${data.total_transactions.toLocaleString()} DLD registered transactions_`;
  }

  return response;
}
