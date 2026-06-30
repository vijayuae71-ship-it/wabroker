import { query } from './index';

interface PropertySeed {
  ref_no: string;
  title: string;
  area: string;
  community?: string;
  building?: string;
  property_type: string;
  listing_type: string;
  bedrooms: string;
  bathrooms: number;
  sqft: number;
  floor?: number;
  total_floors?: number;
  view?: string;
  price: number;
  price_per_sqft: number;
  service_charge_per_sqft?: number;
  cheques_accepted: number;
  furnished: string;
  amenities: string[];
  photo_urls: string[];
  days_on_market: number;
  is_golden_visa_eligible: boolean;
  gross_yield?: number;
  is_off_plan: boolean;
  developer?: string;
  payment_plan?: string;
  is_featured: boolean;
}

const P = {
  marina: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&q=80',
  apt: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80',
  villa: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80',
  town: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80',
  house: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80',
  studio: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80',
  high: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=800&q=80',
  pool: 'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=800&q=80',
  pent: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80',
  ext: 'https://images.unsplash.com/photo-1523217582562-09d0def993a6?w=800&q=80',
  beach: 'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=800&q=80',
  dt: 'https://images.unsplash.com/photo-1444201983204-c43cbd584d93?w=800&q=80',
};

const PROPERTIES: PropertySeed[] = [
  // DUBAI MARINA - SALE
  { ref_no:'DM-S-001', title:'Botanica Tower — Full Marina View', area:'Dubai Marina', community:'Marina Walk', building:'Botanica Tower', property_type:'apartment', listing_type:'sale', bedrooms:'2', bathrooms:3, sqft:1180, floor:24, total_floors:42, view:'Full Marina', price:2050000, price_per_sqft:1737, service_charge_per_sqft:18, cheques_accepted:1, furnished:'unfurnished', amenities:['Pool','Gym','Concierge','Covered Parking','Kids Play Area'], photo_urls:[P.marina,P.apt], days_on_market:47, is_golden_visa_eligible:true, gross_yield:5.2, is_off_plan:false, is_featured:true },
  { ref_no:'DM-S-002', title:'Sunrise Bay — 1BR Sea View', area:'Dubai Marina', community:'Marina Promenade', building:'Sunrise Bay', property_type:'apartment', listing_type:'sale', bedrooms:'1', bathrooms:2, sqft:780, floor:18, total_floors:35, view:'Sea & Marina', price:1450000, price_per_sqft:1859, service_charge_per_sqft:17, cheques_accepted:1, furnished:'furnished', amenities:['Pool','Gym','Sauna','Covered Parking','Security'], photo_urls:[P.high,P.pool], days_on_market:12, is_golden_visa_eligible:false, gross_yield:5.8, is_off_plan:false, is_featured:false },
  { ref_no:'DM-S-003', title:'Marina Gate — 3BR Penthouse', area:'Dubai Marina', community:'Marina Gate', building:'Marina Gate 1', property_type:'apartment', listing_type:'sale', bedrooms:'3', bathrooms:4, sqft:1850, floor:38, total_floors:45, view:'360° Marina & Sea', price:3800000, price_per_sqft:2054, service_charge_per_sqft:20, cheques_accepted:1, furnished:'semi-furnished', amenities:['Infinity Pool','Gym','Concierge','2 Parking','Private Terrace'], photo_urls:[P.pent,P.pool], days_on_market:23, is_golden_visa_eligible:true, gross_yield:4.8, is_off_plan:false, is_featured:true },
  { ref_no:'DM-S-004', title:'Sulafa Tower — Studio Investment', area:'Dubai Marina', community:'JBR Walk', building:'Sulafa Tower', property_type:'studio', listing_type:'sale', bedrooms:'studio', bathrooms:1, sqft:490, floor:12, total_floors:30, view:'City & Pool', price:820000, price_per_sqft:1673, service_charge_per_sqft:15, cheques_accepted:1, furnished:'furnished', amenities:['Pool','Gym','Covered Parking','Security'], photo_urls:[P.studio,P.apt], days_on_market:31, is_golden_visa_eligible:false, gross_yield:7.1, is_off_plan:false, is_featured:false },
  // DOWNTOWN - SALE
  { ref_no:'DT-S-001', title:'Boulevard Heights — Burj Khalifa View', area:'Downtown Dubai', community:'Boulevard', building:'Boulevard Heights T1', property_type:'apartment', listing_type:'sale', bedrooms:'2', bathrooms:3, sqft:1320, floor:30, total_floors:50, view:'Direct Burj Khalifa', price:4200000, price_per_sqft:3182, service_charge_per_sqft:24, cheques_accepted:1, furnished:'unfurnished', amenities:['Pool','Gym','Concierge','Valet Parking','Business Lounge'], photo_urls:[P.dt,P.apt], days_on_market:8, is_golden_visa_eligible:true, gross_yield:4.1, is_off_plan:false, is_featured:true },
  { ref_no:'DT-S-002', title:'Claren Tower — 1BR Downtown', area:'Downtown Dubai', community:'Downtown', building:'Claren Tower 1', property_type:'apartment', listing_type:'sale', bedrooms:'1', bathrooms:2, sqft:860, floor:15, total_floors:28, view:'Fountain & Pool', price:1780000, price_per_sqft:2070, service_charge_per_sqft:20, cheques_accepted:1, furnished:'unfurnished', amenities:['Pool','Gym','Concierge','Covered Parking'], photo_urls:[P.apt,P.pool], days_on_market:19, is_golden_visa_eligible:false, gross_yield:4.9, is_off_plan:false, is_featured:false },
  // BUSINESS BAY - SALE
  { ref_no:'BB-S-001', title:'Damac Paramount — 2BR Canal View', area:'Business Bay', community:'Canal Side', building:'Damac Paramount', property_type:'apartment', listing_type:'sale', bedrooms:'2', bathrooms:3, sqft:1100, floor:20, total_floors:40, view:'Dubai Canal & Skyline', price:1850000, price_per_sqft:1682, service_charge_per_sqft:18, cheques_accepted:1, furnished:'semi-furnished', amenities:['Pool','Gym','Concierge','Covered Parking','Spa'], photo_urls:[P.high,P.dt], days_on_market:35, is_golden_visa_eligible:true, gross_yield:5.5, is_off_plan:false, is_featured:true },
  { ref_no:'BB-S-002', title:'Executive Tower — 1BR Business Bay', area:'Business Bay', community:'Bay Square', building:'Executive Tower G', property_type:'apartment', listing_type:'sale', bedrooms:'1', bathrooms:2, sqft:750, floor:10, total_floors:25, view:'City & Canal', price:1050000, price_per_sqft:1400, service_charge_per_sqft:16, cheques_accepted:2, furnished:'unfurnished', amenities:['Pool','Gym','Covered Parking','Security'], photo_urls:[P.apt,P.high], days_on_market:52, is_golden_visa_eligible:false, gross_yield:6.2, is_off_plan:false, is_featured:false },
  // JVC - SALE
  { ref_no:'JVC-S-001', title:'Belgravia Heights — 2BR Modern', area:'JVC', community:'Jumeirah Village Circle', building:'Belgravia Heights 1', property_type:'apartment', listing_type:'sale', bedrooms:'2', bathrooms:2, sqft:1050, floor:5, total_floors:18, view:'Pool & Community', price:1050000, price_per_sqft:1000, service_charge_per_sqft:13, cheques_accepted:4, furnished:'unfurnished', amenities:['Pool','Gym','Kids Play Area','Covered Parking'], photo_urls:[P.pool,P.apt], days_on_market:28, is_golden_visa_eligible:false, gross_yield:7.2, is_off_plan:false, is_featured:false },
  { ref_no:'JVC-S-002', title:'Ghalia — 3BR Townhouse JVC', area:'JVC', community:'District 15', building:'Ghalia Townhouses', property_type:'townhouse', listing_type:'sale', bedrooms:'3', bathrooms:4, sqft:2100, floor:1, total_floors:3, view:'Private Garden', price:2200000, price_per_sqft:1048, service_charge_per_sqft:10, cheques_accepted:4, furnished:'unfurnished', amenities:['Private Garden','Shared Pool','Gym','2 Parking','Kids Park'], photo_urls:[P.town,P.villa], days_on_market:41, is_golden_visa_eligible:true, gross_yield:5.8, is_off_plan:false, is_featured:false },
  { ref_no:'JVC-S-003', title:'Oxford Residence — 1BR Starter', area:'JVC', community:'District 11', building:'Oxford Residence', property_type:'apartment', listing_type:'sale', bedrooms:'1', bathrooms:2, sqft:650, floor:3, total_floors:12, view:'Community & Garden', price:680000, price_per_sqft:1046, service_charge_per_sqft:12, cheques_accepted:4, furnished:'unfurnished', amenities:['Pool','Gym','Covered Parking','Security'], photo_urls:[P.studio,P.pool], days_on_market:18, is_golden_visa_eligible:false, gross_yield:7.5, is_off_plan:false, is_featured:false },
  // DUBAI HILLS - SALE
  { ref_no:'DH-S-001', title:'Club Villas — 3BR Golf View', area:'Dubai Hills', community:'Club Villas', building:'Club Villas', property_type:'villa', listing_type:'sale', bedrooms:'3', bathrooms:4, sqft:3200, view:'Golf Course', price:5800000, price_per_sqft:1813, service_charge_per_sqft:8, cheques_accepted:1, furnished:'unfurnished', amenities:['Private Pool','Garden','Garage','Maid Room','Golf Course Access'], photo_urls:[P.villa,P.ext], days_on_market:15, is_golden_visa_eligible:true, gross_yield:4.2, is_off_plan:false, is_featured:true },
  { ref_no:'DH-S-002', title:'Park Heights — 2BR Dubai Hills', area:'Dubai Hills', community:'Park Heights', building:'Park Heights 1', property_type:'apartment', listing_type:'sale', bedrooms:'2', bathrooms:2, sqft:1150, floor:8, total_floors:20, view:'Park & Pool', price:1950000, price_per_sqft:1696, service_charge_per_sqft:15, cheques_accepted:2, furnished:'unfurnished', amenities:['Pool','Gym','Park Access','Covered Parking','Kids Area'], photo_urls:[P.pool,P.apt], days_on_market:22, is_golden_visa_eligible:false, gross_yield:5.1, is_off_plan:false, is_featured:false },
  // PALM JUMEIRAH - SALE
  { ref_no:'PJ-S-001', title:'Shoreline — 3BR Beachfront', area:'Palm Jumeirah', community:'Shoreline', building:'Al Hamri', property_type:'apartment', listing_type:'sale', bedrooms:'3', bathrooms:4, sqft:2400, floor:5, total_floors:8, view:'Direct Beach & Sea', price:8500000, price_per_sqft:3542, service_charge_per_sqft:25, cheques_accepted:1, furnished:'semi-furnished', amenities:['Private Beach','Pool','Gym','2 Parking','Concierge','Kids Club'], photo_urls:[P.beach,P.pool], days_on_market:10, is_golden_visa_eligible:true, gross_yield:3.8, is_off_plan:false, is_featured:true },
  // MBR CITY / SOBHA
  { ref_no:'SH-S-001', title:'Sobha Hartland — 2BR Waterfront', area:'MBR City', community:'Sobha Hartland', building:'Waves Opulence', property_type:'apartment', listing_type:'sale', bedrooms:'2', bathrooms:3, sqft:1280, floor:22, total_floors:38, view:'Lagoon & Downtown Skyline', price:2850000, price_per_sqft:2227, service_charge_per_sqft:20, cheques_accepted:1, furnished:'unfurnished', amenities:['Infinity Pool','Gym','Private Beach','Concierge','Jogging Track'], photo_urls:[P.high,P.beach], days_on_market:6, is_golden_visa_eligible:true, gross_yield:4.5, is_off_plan:false, is_featured:true },
  // ARABIAN RANCHES - SALE
  { ref_no:'AR-S-001', title:'Arabian Ranches 2 — 4BR Family Villa', area:'Arabian Ranches', community:'Rasha', building:'Rasha Villas', property_type:'villa', listing_type:'sale', bedrooms:'4', bathrooms:5, sqft:4800, view:'Lake & Community', price:6800000, price_per_sqft:1417, service_charge_per_sqft:7, cheques_accepted:2, furnished:'unfurnished', amenities:['Private Pool','Garden','Double Garage','Maid Room','BBQ Area'], photo_urls:[P.villa,P.ext], days_on_market:33, is_golden_visa_eligible:true, gross_yield:3.9, is_off_plan:false, is_featured:false },
  // OFF-PLAN
  { ref_no:'OP-S-001', title:'Sobha Reserve — 4BR Villa (Off-Plan)', area:'Dubailand', community:'Sobha Reserve', building:'', property_type:'villa', listing_type:'sale', bedrooms:'4', bathrooms:5, sqft:5200, view:'Forest & Lake', price:9500000, price_per_sqft:1827, service_charge_per_sqft:6, cheques_accepted:1, furnished:'unfurnished', amenities:['Private Pool','Smart Home','Private Garden','Maid Room','3 Parking'], photo_urls:[P.villa,P.house], days_on_market:0, is_golden_visa_eligible:true, gross_yield:0, is_off_plan:true, developer:'Sobha Realty', payment_plan:'50/50 | 10% on booking | Handover Q4 2026', is_featured:true },
  { ref_no:'OP-S-002', title:'Emaar Grande — 2BR Creek Harbour (Off-Plan)', area:'Creek Harbour', community:'Grande', building:'', property_type:'apartment', listing_type:'sale', bedrooms:'2', bathrooms:3, sqft:1200, floor:25, total_floors:42, view:'Creek & Downtown', price:2600000, price_per_sqft:2167, service_charge_per_sqft:18, cheques_accepted:1, furnished:'unfurnished', amenities:['Infinity Pool','Gym','Boardwalk Access','Concierge'], photo_urls:[P.dt,P.high], days_on_market:0, is_golden_visa_eligible:true, gross_yield:0, is_off_plan:true, developer:'Emaar Properties', payment_plan:'80/20 | 10% on booking | Handover Q2 2027', is_featured:false },
  // DSO - SALE
  { ref_no:'DSO-S-001', title:'Silicon Gates — 1BR Starter', area:'Dubai Silicon Oasis', community:'Silicon Gates', building:'Silicon Gates 3', property_type:'apartment', listing_type:'sale', bedrooms:'1', bathrooms:2, sqft:680, floor:7, total_floors:15, view:'Community', price:580000, price_per_sqft:853, service_charge_per_sqft:11, cheques_accepted:4, furnished:'unfurnished', amenities:['Pool','Gym','Covered Parking','Security'], photo_urls:[P.studio,P.pool], days_on_market:38, is_golden_visa_eligible:false, gross_yield:7.8, is_off_plan:false, is_featured:false },
  // DAMAC HILLS - SALE
  { ref_no:'DC-S-001', title:'Aknan Villas — 3BR Damac Hills', area:'Damac Hills', community:'Aknan', building:'', property_type:'townhouse', listing_type:'sale', bedrooms:'3', bathrooms:4, sqft:2400, view:'Golf & Community', price:2650000, price_per_sqft:1104, service_charge_per_sqft:9, cheques_accepted:4, furnished:'unfurnished', amenities:['Shared Pool','Gym','2 Parking','Golf Course Access','Park'], photo_urls:[P.town,P.villa], days_on_market:45, is_golden_visa_eligible:true, gross_yield:5.0, is_off_plan:false, is_featured:false },
  // JBR - SALE
  { ref_no:'JBR-S-001', title:'Murjan Towers — 2BR Beachfront', area:'JBR', community:'Jumeirah Beach Residence', building:'Murjan 1', property_type:'apartment', listing_type:'sale', bedrooms:'2', bathrooms:2, sqft:1500, floor:10, total_floors:35, view:'Direct Beach & Sea', price:3200000, price_per_sqft:2133, service_charge_per_sqft:20, cheques_accepted:2, furnished:'unfurnished', amenities:['Beach Access','Pool','Gym','Covered Parking','Restaurants'], photo_urls:[P.beach,P.pool], days_on_market:18, is_golden_visa_eligible:true, gross_yield:4.6, is_off_plan:false, is_featured:true },
  // BLUEWATERS - SALE
  { ref_no:'BW-S-001', title:'Bluewaters — 2BR Ain Dubai View', area:'Bluewaters Island', community:'Bluewaters Residences', building:'Building 8', property_type:'apartment', listing_type:'sale', bedrooms:'2', bathrooms:3, sqft:1350, floor:7, total_floors:10, view:'Ain Dubai & Sea', price:4100000, price_per_sqft:3037, service_charge_per_sqft:22, cheques_accepted:1, furnished:'unfurnished', amenities:['Beach Access','Pool','Gym','Covered Parking','Retail & Restaurants'], photo_urls:[P.beach,P.marina], days_on_market:13, is_golden_visa_eligible:true, gross_yield:4.3, is_off_plan:false, is_featured:true },
  // TOWN SQUARE - SALE
  { ref_no:'TS-S-001', title:'Town Square — 2BR Affordable', area:'Town Square', community:'Zahra Apartments', building:'Zahra 1A', property_type:'apartment', listing_type:'sale', bedrooms:'2', bathrooms:2, sqft:1020, floor:4, total_floors:10, view:'Park & Community', price:950000, price_per_sqft:931, service_charge_per_sqft:12, cheques_accepted:4, furnished:'unfurnished', amenities:['Pool','Gym','Park','Kids Area','Retail Below'], photo_urls:[P.pool,P.town], days_on_market:36, is_golden_visa_eligible:false, gross_yield:6.8, is_off_plan:false, is_featured:false },
  // AL FURJAN - SALE
  { ref_no:'AF-S-001', title:'Masakin Al Furjan — 3BR Townhouse', area:'Al Furjan', community:'Masakin Al Furjan', building:'', property_type:'townhouse', listing_type:'sale', bedrooms:'3', bathrooms:4, sqft:2600, view:'Community & Pool', price:2300000, price_per_sqft:885, service_charge_per_sqft:9, cheques_accepted:4, furnished:'unfurnished', amenities:['Shared Pool','Gym','2 Parking','Private Courtyard','Near Metro'], photo_urls:[P.town,P.villa], days_on_market:27, is_golden_visa_eligible:true, gross_yield:5.5, is_off_plan:false, is_featured:false },
  // REMRAAM - SALE
  { ref_no:'RR-S-001', title:'Remraam — 1BR Entry-Level', area:'Remraam', community:'Al Thamam', building:'', property_type:'apartment', listing_type:'sale', bedrooms:'1', bathrooms:1, sqft:720, floor:2, total_floors:6, view:'Community', price:540000, price_per_sqft:750, service_charge_per_sqft:11, cheques_accepted:4, furnished:'unfurnished', amenities:['Pool','Gym','Covered Parking','Kids Play Area'], photo_urls:[P.pool,P.studio], days_on_market:50, is_golden_visa_eligible:false, gross_yield:7.9, is_off_plan:false, is_featured:false },

  // ===== RENTALS =====
  // DUBAI MARINA - RENT
  { ref_no:'DM-R-001', title:'Cayan Tower — 2BR Marina Rent', area:'Dubai Marina', community:'Marina Towers', building:'Cayan Tower', property_type:'apartment', listing_type:'rent', bedrooms:'2', bathrooms:3, sqft:1200, floor:28, total_floors:73, view:'Full Marina & Sea', price:165000, price_per_sqft:138, cheques_accepted:4, furnished:'furnished', amenities:['Pool','Gym','Concierge','Covered Parking','Spa'], photo_urls:[P.marina,P.apt], days_on_market:5, is_golden_visa_eligible:false, gross_yield:0, is_off_plan:false, is_featured:true },
  { ref_no:'DM-R-002', title:'Marina Crown — 1BR Furnished', area:'Dubai Marina', community:'Marina Gate', building:'Marina Crown', property_type:'apartment', listing_type:'rent', bedrooms:'1', bathrooms:2, sqft:820, floor:20, total_floors:35, view:'Marina & Pool', price:110000, price_per_sqft:134, cheques_accepted:4, furnished:'furnished', amenities:['Pool','Gym','Covered Parking','Security','Kids Play Area'], photo_urls:[P.high,P.apt], days_on_market:14, is_golden_visa_eligible:false, gross_yield:0, is_off_plan:false, is_featured:false },
  { ref_no:'DM-R-003', title:'Address Marina — Studio Premium', area:'Dubai Marina', community:'JBR Walk', building:'The Address Dubai Marina', property_type:'studio', listing_type:'rent', bedrooms:'studio', bathrooms:1, sqft:520, floor:15, total_floors:40, view:'Marina & JBR', price:82000, price_per_sqft:158, cheques_accepted:2, furnished:'furnished', amenities:['Hotel Pool','Gym','Concierge','Valet','Restaurant'], photo_urls:[P.studio,P.pool], days_on_market:3, is_golden_visa_eligible:false, gross_yield:0, is_off_plan:false, is_featured:false },
  // DOWNTOWN - RENT
  { ref_no:'DT-R-001', title:'Burj Views — 1BR Burj Khalifa View', area:'Downtown Dubai', community:'Burj Khalifa District', building:'Burj Views A', property_type:'apartment', listing_type:'rent', bedrooms:'1', bathrooms:2, sqft:880, floor:22, total_floors:32, view:'Direct Burj Khalifa', price:130000, price_per_sqft:148, cheques_accepted:2, furnished:'unfurnished', amenities:['Pool','Gym','Concierge','Covered Parking'], photo_urls:[P.dt,P.apt], days_on_market:9, is_golden_visa_eligible:false, gross_yield:0, is_off_plan:false, is_featured:true },
  { ref_no:'DT-R-002', title:'The Lofts — 2BR Downtown Rent', area:'Downtown Dubai', community:'Downtown', building:'The Lofts West', property_type:'apartment', listing_type:'rent', bedrooms:'2', bathrooms:3, sqft:1280, floor:12, total_floors:22, view:'Pool & City', price:165000, price_per_sqft:129, cheques_accepted:4, furnished:'unfurnished', amenities:['Pool','Gym','Covered Parking','Security'], photo_urls:[P.apt,P.dt], days_on_market:21, is_golden_visa_eligible:false, gross_yield:0, is_off_plan:false, is_featured:false },
  // BUSINESS BAY - RENT
  { ref_no:'BB-R-001', title:'Bay Square — 1BR Canal View Rent', area:'Business Bay', community:'Bay Square', building:'Bay Square 8', property_type:'apartment', listing_type:'rent', bedrooms:'1', bathrooms:2, sqft:770, floor:8, total_floors:22, view:'Dubai Canal', price:90000, price_per_sqft:117, cheques_accepted:4, furnished:'unfurnished', amenities:['Pool','Gym','Covered Parking','Security'], photo_urls:[P.high,P.pool], days_on_market:16, is_golden_visa_eligible:false, gross_yield:0, is_off_plan:false, is_featured:false },
  { ref_no:'BB-R-002', title:'Vera Residences — 2BR Business Bay', area:'Business Bay', community:'Business Bay', building:'Vera Residences', property_type:'apartment', listing_type:'rent', bedrooms:'2', bathrooms:3, sqft:1100, floor:15, total_floors:35, view:'Canal & Skyline', price:120000, price_per_sqft:109, cheques_accepted:4, furnished:'semi-furnished', amenities:['Pool','Gym','Kids Area','Covered Parking','Security'], photo_urls:[P.apt,P.high], days_on_market:29, is_golden_visa_eligible:false, gross_yield:0, is_off_plan:false, is_featured:false },
  { ref_no:'BB-R-003', title:'Churchill Executive — Studio Rent', area:'Business Bay', community:'Churchill', building:'Churchill Executive', property_type:'studio', listing_type:'rent', bedrooms:'studio', bathrooms:1, sqft:480, floor:5, total_floors:20, view:'City', price:68000, price_per_sqft:142, cheques_accepted:4, furnished:'furnished', amenities:['Pool','Gym','Covered Parking'], photo_urls:[P.studio,P.apt], days_on_market:44, is_golden_visa_eligible:false, gross_yield:0, is_off_plan:false, is_featured:false },
  // JVC - RENT
  { ref_no:'JVC-R-001', title:'Bloom Heights — 1BR JVC Rent', area:'JVC', community:'Jumeirah Village Circle', building:'Bloom Heights', property_type:'apartment', listing_type:'rent', bedrooms:'1', bathrooms:1, sqft:670, floor:4, total_floors:12, view:'Community & Pool', price:58000, price_per_sqft:87, cheques_accepted:6, furnished:'unfurnished', amenities:['Pool','Gym','Kids Play Area','Covered Parking'], photo_urls:[P.pool,P.studio], days_on_market:7, is_golden_visa_eligible:false, gross_yield:0, is_off_plan:false, is_featured:false },
  { ref_no:'JVC-R-002', title:'Plazzo Residence — 2BR JVC', area:'JVC', community:'District 14', building:'Plazzo Residence', property_type:'apartment', listing_type:'rent', bedrooms:'2', bathrooms:2, sqft:1080, floor:6, total_floors:14, view:'Garden & Pool', price:78000, price_per_sqft:72, cheques_accepted:6, furnished:'unfurnished', amenities:['Pool','Gym','Kids Play Area','2 Covered Parking'], photo_urls:[P.pool,P.apt], days_on_market:25, is_golden_visa_eligible:false, gross_yield:0, is_off_plan:false, is_featured:false },
  { ref_no:'JVC-R-003', title:'Diamond Views — Studio Budget JVC', area:'JVC', community:'District 10', building:'Diamond Views 4', property_type:'studio', listing_type:'rent', bedrooms:'studio', bathrooms:1, sqft:420, floor:2, total_floors:8, view:'Community', price:42000, price_per_sqft:100, cheques_accepted:12, furnished:'unfurnished', amenities:['Pool','Gym','Covered Parking'], photo_urls:[P.studio], days_on_market:33, is_golden_visa_eligible:false, gross_yield:0, is_off_plan:false, is_featured:false },
  // DEIRA - RENT
  { ref_no:'DR-R-001', title:'Al Rigga — 1BR Budget', area:'Deira', community:'Al Rigga', building:'', property_type:'apartment', listing_type:'rent', bedrooms:'1', bathrooms:1, sqft:650, floor:3, total_floors:10, view:'Street', price:42000, price_per_sqft:65, cheques_accepted:12, furnished:'unfurnished', amenities:['Central AC','Security','Near Metro'], photo_urls:[P.studio], days_on_market:2, is_golden_visa_eligible:false, gross_yield:0, is_off_plan:false, is_featured:false },
  { ref_no:'DR-R-002', title:'Deira — Studio Near Gold Souk', area:'Deira', community:'Gold Souk', building:'', property_type:'studio', listing_type:'rent', bedrooms:'studio', bathrooms:1, sqft:380, floor:2, total_floors:8, view:'Street', price:30000, price_per_sqft:79, cheques_accepted:12, furnished:'furnished', amenities:['Central AC','Security','Near Metro','Near Mall'], photo_urls:[P.studio], days_on_market:1, is_golden_visa_eligible:false, gross_yield:0, is_off_plan:false, is_featured:false },
  // AL BARSHA - RENT
  { ref_no:'AB-R-001', title:'Al Barsha — 2BR Near Mall of Emirates', area:'Al Barsha', community:'Al Barsha 1', building:'', property_type:'apartment', listing_type:'rent', bedrooms:'2', bathrooms:2, sqft:1100, floor:4, total_floors:12, view:'Community', price:85000, price_per_sqft:77, cheques_accepted:4, furnished:'unfurnished', amenities:['Pool','Gym','Covered Parking','Near Mall of Emirates'], photo_urls:[P.apt,P.pool], days_on_market:11, is_golden_visa_eligible:false, gross_yield:0, is_off_plan:false, is_featured:false },
  // DUBAI HILLS - RENT
  { ref_no:'DH-R-001', title:'Dubai Hills Maple — 3BR Villa Rent', area:'Dubai Hills', community:'Maple', building:'Maple 2', property_type:'villa', listing_type:'rent', bedrooms:'3', bathrooms:4, sqft:3200, view:'Park & Golf', price:220000, price_per_sqft:69, cheques_accepted:2, furnished:'unfurnished', amenities:['Private Garden','Shared Pool','Gym','2 Parking','Kids Park'], photo_urls:[P.villa,P.ext], days_on_market:6, is_golden_visa_eligible:false, gross_yield:0, is_off_plan:false, is_featured:true },
  // JUMEIRAH - RENT
  { ref_no:'JUM-R-001', title:'Jumeirah 1 — 3BR Beach Villa', area:'Jumeirah', community:'Jumeirah 1', building:'', property_type:'villa', listing_type:'rent', bedrooms:'3', bathrooms:4, sqft:4500, view:'Beach Access', price:295000, price_per_sqft:66, cheques_accepted:2, furnished:'unfurnished', amenities:['Private Garden','Pool','Maid Room','2 Parking','Near Beach'], photo_urls:[P.beach,P.ext], days_on_market:4, is_golden_visa_eligible:false, gross_yield:0, is_off_plan:false, is_featured:false },
  // MIRDIF - RENT
  { ref_no:'MR-R-001', title:'Mirdif Shorooq — 3BR Family Villa', area:'Mirdif', community:'Shorooq', building:'', property_type:'villa', listing_type:'rent', bedrooms:'3', bathrooms:3, sqft:2800, view:'Community Garden', price:145000, price_per_sqft:52, cheques_accepted:4, furnished:'unfurnished', amenities:['Private Garden','Community Pool','Parking','Near Schools'], photo_urls:[P.town,P.ext], days_on_market:17, is_golden_visa_eligible:false, gross_yield:0, is_off_plan:false, is_featured:false },
  // INTERNATIONAL CITY - RENT
  { ref_no:'IC-R-001', title:'International City — Studio Super Budget', area:'International City', community:'France Cluster', building:'', property_type:'studio', listing_type:'rent', bedrooms:'studio', bathrooms:1, sqft:380, floor:2, total_floors:6, view:'Community', price:28000, price_per_sqft:74, cheques_accepted:12, furnished:'unfurnished', amenities:['Central AC','Security','Near Dragon Mart'], photo_urls:[P.studio], days_on_market:3, is_golden_visa_eligible:false, gross_yield:0, is_off_plan:false, is_featured:false },
  { ref_no:'IC-R-002', title:'International City — 1BR Affordable', area:'International City', community:'Spain Cluster', building:'', property_type:'apartment', listing_type:'rent', bedrooms:'1', bathrooms:1, sqft:600, floor:3, total_floors:6, view:'Community', price:38000, price_per_sqft:63, cheques_accepted:12, furnished:'unfurnished', amenities:['Central AC','Security'], photo_urls:[P.studio,P.pool], days_on_market:5, is_golden_visa_eligible:false, gross_yield:0, is_off_plan:false, is_featured:false },
  // DUBAI SPORTS CITY - RENT
  { ref_no:'DSC-R-001', title:'Golf Tower — 1BR Sports City', area:'Dubai Sports City', community:'Victory Heights', building:'Golf Tower', property_type:'apartment', listing_type:'rent', bedrooms:'1', bathrooms:1, sqft:700, floor:6, total_floors:15, view:'Golf Course', price:52000, price_per_sqft:74, cheques_accepted:6, furnished:'unfurnished', amenities:['Pool','Gym','Golf View','Covered Parking'], photo_urls:[P.pool,P.studio], days_on_market:20, is_golden_visa_eligible:false, gross_yield:0, is_off_plan:false, is_featured:false },
  // AL NAHDA - RENT
  { ref_no:'AN-R-001', title:'Al Nahda — 1BR Affordable', area:'Al Nahda', community:'Al Nahda 2', building:'', property_type:'apartment', listing_type:'rent', bedrooms:'1', bathrooms:1, sqft:680, floor:4, total_floors:12, view:'Community', price:50000, price_per_sqft:74, cheques_accepted:6, furnished:'unfurnished', amenities:['Pool','Gym','Covered Parking','Near City Centre'], photo_urls:[P.studio,P.pool], days_on_market:8, is_golden_visa_eligible:false, gross_yield:0, is_off_plan:false, is_featured:false },
  // DAMAC HILLS - RENT
  { ref_no:'DC-R-001', title:'Damac Hills — 3BR Golf Townhouse Rent', area:'Damac Hills', community:'Pelham', building:'', property_type:'townhouse', listing_type:'rent', bedrooms:'3', bathrooms:3, sqft:2200, view:'Golf Course', price:140000, price_per_sqft:64, cheques_accepted:4, furnished:'unfurnished', amenities:['Shared Pool','Gym','2 Parking','Golf Access','Supermarket Nearby'], photo_urls:[P.town,P.ext], days_on_market:12, is_golden_visa_eligible:false, gross_yield:0, is_off_plan:false, is_featured:false },
  // JBR - RENT
  { ref_no:'JBR-R-001', title:'Bahar Residence — 2BR JBR Rent', area:'JBR', community:'Jumeirah Beach Residence', building:'Bahar 4', property_type:'apartment', listing_type:'rent', bedrooms:'2', bathrooms:2, sqft:1380, floor:8, total_floors:32, view:'Sea & Beach', price:175000, price_per_sqft:127, cheques_accepted:4, furnished:'unfurnished', amenities:['Beach Access','Pool','Gym','Covered Parking'], photo_urls:[P.beach,P.marina], days_on_market:7, is_golden_visa_eligible:false, gross_yield:0, is_off_plan:false, is_featured:false },
  // DIFC - RENT
  { ref_no:'DIFC-R-001', title:'Index Tower — 1BR DIFC', area:'DIFC', community:'Gate Village', building:'Index Tower', property_type:'apartment', listing_type:'rent', bedrooms:'1', bathrooms:2, sqft:900, floor:25, total_floors:80, view:'Downtown & DIFC', price:130000, price_per_sqft:144, cheques_accepted:2, furnished:'furnished', amenities:['Pool','Gym','Concierge','Valet','Business Centre'], photo_urls:[P.dt,P.apt], days_on_market:4, is_golden_visa_eligible:false, gross_yield:0, is_off_plan:false, is_featured:false },
  // MOTOR CITY - RENT
  { ref_no:'MC-R-001', title:'Motor City — 2BR Cosy Apartment', area:'Motor City', community:'Upper Springs', building:'', property_type:'apartment', listing_type:'rent', bedrooms:'2', bathrooms:2, sqft:1100, floor:3, total_floors:8, view:'Community & Park', price:82000, price_per_sqft:75, cheques_accepted:4, furnished:'unfurnished', amenities:['Pool','Gym','Covered Parking','Near Supermarket'], photo_urls:[P.pool,P.apt], days_on_market:22, is_golden_visa_eligible:false, gross_yield:0, is_off_plan:false, is_featured:false },
  // JVT - RENT
  { ref_no:'JVT-R-001', title:'JVT — 2BR Spacious Apartment', area:'JVT', community:'District 4', building:'', property_type:'apartment', listing_type:'rent', bedrooms:'2', bathrooms:2, sqft:1150, floor:5, total_floors:14, view:'Community Garden', price:76000, price_per_sqft:66, cheques_accepted:6, furnished:'unfurnished', amenities:['Pool','Gym','Kids Play Area','Covered Parking'], photo_urls:[P.pool,P.apt], days_on_market:14, is_golden_visa_eligible:false, gross_yield:0, is_off_plan:false, is_featured:false },
];

export async function seedProperties(agencyId: string): Promise<void> {
  try {
    const { rows } = await query('SELECT COUNT(*) as count FROM properties WHERE is_active = true');
    if (parseInt(rows[0].count) > 0) {
      console.log(`✅ Properties already seeded (${rows[0].count} listings)`);
      return;
    }
    console.log(`🏘️ Seeding ${PROPERTIES.length} Dubai properties...`);
    for (const p of PROPERTIES) {
      await query(`
        INSERT INTO properties (
          agency_id, ref_no, title, area, community, building,
          property_type, listing_type, bedrooms, bathrooms, sqft,
          floor, total_floors, view, price, price_per_sqft,
          service_charge_per_sqft, cheques_accepted, furnished,
          amenities, photo_urls, days_on_market, is_golden_visa_eligible,
          gross_yield, is_off_plan, developer, payment_plan, is_featured
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28
        ) ON CONFLICT (ref_no) DO NOTHING
      `, [
        agencyId, p.ref_no, p.title, p.area, p.community||null, p.building||null,
        p.property_type, p.listing_type, p.bedrooms, p.bathrooms, p.sqft,
        p.floor||null, p.total_floors||null, p.view||null, p.price, p.price_per_sqft,
        p.service_charge_per_sqft||null, p.cheques_accepted, p.furnished,
        p.amenities, p.photo_urls, p.days_on_market, p.is_golden_visa_eligible,
        p.gross_yield||null, p.is_off_plan, p.developer||null, p.payment_plan||null, p.is_featured,
      ]);
    }
    console.log(`✅ Seeded ${PROPERTIES.length} properties`);
  } catch (err) {
    console.error('Property seed error:', err);
  }
}
