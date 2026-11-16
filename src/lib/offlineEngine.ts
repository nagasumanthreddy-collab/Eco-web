import { addDaysISO, predictForDate, predictHorizon } from '../../ml/forecaster.ts';
import type {
  AdminOrganization,
  DailyEntry,
  NgoPartner,
  OrganizationType,
  SurplusListing,
  User,
  WasteAlertItem,
} from '../types.ts';

interface StoredUser extends User {
  password: string;
}

interface OfflineDb {
  users: StoredUser[];
  entries: DailyEntry[];
  ngos: NgoPartner[];
  surplus: SurplusListing[];
  currentUserId: string | null;
  resetCodes: Record<string, string>;
}

const OFFLINE_DB_KEY = 'ecopredict_offline_db_v1';
const CO2_KG_PER_FOOD_KG = 2.5;

const SPECIAL_EVENTS: Record<number, string> = {
  4: 'Campus Welcome Fair',
  11: 'Inter-College Hackathon',
  19: 'Alumni Homecoming Dinner',
  27: 'Annual Tech Symposium',
  35: 'Midterm Study Night',
  44: 'Sustainability Summit',
  53: 'Spring Cultural Night',
};

const MEAL_CONFIGS = [
  { mealType: 'Breakfast', category: 'Bakery & Pastry', baseConsumed: 36, baseHeadcount: 145, costPerKg: 3.8 },
  { mealType: 'Lunch', category: 'Grains & Rice', baseConsumed: 78, baseHeadcount: 310, costPerKg: 4.5 },
  { mealType: 'Lunch', category: 'Proteins & Mains', baseConsumed: 64, baseHeadcount: 310, costPerKg: 6.4 },
  { mealType: 'Dinner', category: 'Produce & Salads', baseConsumed: 52, baseHeadcount: 230, costPerKg: 4.9 },
  { mealType: 'Snacks', category: 'Dairy & Desserts', baseConsumed: 24, baseHeadcount: 110, costPerKg: 5.2 },
];

const WEEKDAY_MULTIPLIERS: Record<number, number> = {
  0: 0.88,
  1: 0.96,
  2: 0.99,
  3: 1.02,
  4: 1.05,
  5: 1.15,
  6: 0.97,
};

function seededNoise(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function createInitialDb(): OfflineDb {
  const vendorUser: StoredUser = {
    id: 'usr_vendor_demo',
    name: 'Maya Lin',
    email: 'vendor@ecopredict.io',
    password: 'Vendor@1234',
    role: 'VENDOR',
    organizationName: 'GreenPlate Campus Canteen',
    organizationType: 'Canteen',
    wasteAlertThreshold: 11.5,
    emailAlerts: true,
    surplusAlerts: true,
    dailyDigest: true,
  };

  const adminUser: StoredUser = {
    id: 'usr_admin_demo',
    name: 'Arjun Mehta',
    email: 'admin@ecopredict.io',
    password: 'Admin@1234',
    role: 'ADMIN',
    organizationName: 'Metro Dining Operations',
    organizationType: 'Restaurant',
    wasteAlertThreshold: 10.0,
    emailAlerts: true,
    surplusAlerts: true,
    dailyDigest: true,
  };

  const today = new Date();
  today.setUTCHours(12, 0, 0, 0);
  const entries: DailyEntry[] = [];
  let entryCounter = 1;

  for (let dayOffset = 59; dayOffset >= 0; dayOffset--) {
    const dt = new Date(today);
    dt.setUTCDate(today.getUTCDate() - dayOffset);
    const dateStr = dt.toISOString().slice(0, 10);
    const dow = dt.getUTCDay();
    const dowMultiplier = WEEKDAY_MULTIPLIERS[dow] ?? 1.0;

    const eventLabel = SPECIAL_EVENTS[dayOffset] ?? null;
    const isSpecialEvent = Boolean(eventLabel);
    const eventMultiplier = isSpecialEvent ? 1.19 : 1.0;
    const improvementFactor = 0.165 - ((59 - dayOffset) / 59) * 0.08;

    for (let idx = 0; idx < MEAL_CONFIGS.length; idx++) {
      const cfg = MEAL_CONFIGS[idx];
      const noise = (seededNoise(dayOffset * 17 + idx * 31) - 0.5) * 0.12;
      const consumedKg = Number(
        Math.max(8, cfg.baseConsumed * dowMultiplier * eventMultiplier * (1 + noise)).toFixed(1)
      );
      const wasteSpike =
        (dow === 5 && idx === 1 ? 0.05 : 0) +
        (idx === 0 ? 0.035 : 0) +
        (seededNoise(dayOffset * 7 + idx) - 0.4) * 0.04;
      const wasteRatio = Math.max(0.03, improvementFactor + wasteSpike);
      const preparedKg = Number((consumedKg / (1 - wasteRatio)).toFixed(1));
      const leftoverKg = Number(Math.max(0, preparedKg - consumedKg).toFixed(1));
      const headcount = Math.round(cfg.baseHeadcount * dowMultiplier * eventMultiplier * (1 + noise * 0.7));

      entries.push({
        id: `ent_${entryCounter++}`,
        date: dateStr,
        mealType: cfg.mealType,
        category: cfg.category,
        preparedKg,
        consumedKg,
        leftoverKg,
        headcount,
        isSpecialEvent,
        eventLabel,
        costPerKg: cfg.costPerKg,
        notes: isSpecialEvent ? `Event service: ${eventLabel}` : null,
        userId: vendorUser.id,
        user: { name: vendorUser.name, organizationName: vendorUser.organizationName },
      });

      if (idx < 3) {
        const adminConsumed = Number((consumedKg * 0.82).toFixed(1));
        const adminPrepared = Number((adminConsumed / (1 - wasteRatio * 0.92)).toFixed(1));
        entries.push({
          id: `ent_${entryCounter++}`,
          date: dateStr,
          mealType: cfg.mealType,
          category: cfg.category,
          preparedKg: adminPrepared,
          consumedKg: adminConsumed,
          leftoverKg: Number(Math.max(0, adminPrepared - adminConsumed).toFixed(1)),
          headcount: Math.round(headcount * 0.8),
          isSpecialEvent,
          eventLabel,
          costPerKg: cfg.costPerKg + 0.8,
          notes: isSpecialEvent ? `Banquet surge: ${eventLabel}` : null,
          userId: adminUser.id,
          user: { name: adminUser.name, organizationName: adminUser.organizationName },
        });
      }
    }
  }

  const ngos: NgoPartner[] = [
    {
      id: 'ngo_1',
      name: 'City Harvest Community Kitchen',
      address: '412 Market Street, Downtown District',
      distanceKm: 1.8,
      acceptedTypes: 'Cooked Meals, Grains & Rice, Produce',
      dailyCapacityKg: 140,
      contactPhone: '+1 (555) 234-8910',
      contactEmail: 'dispatch@cityharvest.org',
      operatingHours: '07:00 – 22:00 daily',
    },
    {
      id: 'ngo_2',
      name: 'Mercy Meal Rescue Network',
      address: '88 Oakridge Avenue, East Campus',
      distanceKm: 2.9,
      acceptedTypes: 'Hot Mains, Bakery & Pastry, Dairy',
      dailyCapacityKg: 95,
      contactPhone: '+1 (555) 392-4411',
      contactEmail: 'rescue@mercymeals.org',
      operatingHours: '08:30 – 21:00 daily',
    },
    {
      id: 'ngo_3',
      name: 'GreenBite Neighborhood Fridge',
      address: '19 Cedar Lane, University Quarter',
      distanceKm: 1.1,
      acceptedTypes: 'Packaged Salads, Bakery, Fresh Produce',
      dailyCapacityKg: 55,
      contactPhone: '+1 (555) 781-0932',
      contactEmail: 'hello@greenbitefridge.org',
      operatingHours: '24/7 refrigerated drop-off',
    },
    {
      id: 'ngo_4',
      name: 'Sunrise Youth & Family Shelter',
      address: '305 Elm Boulevard, Westside',
      distanceKm: 4.4,
      acceptedTypes: 'All Prepared Meals, Grains, Proteins',
      dailyCapacityKg: 180,
      contactPhone: '+1 (555) 640-2277',
      contactEmail: 'kitchen@sunriseshelter.org',
      operatingHours: '06:30 – 20:30 daily',
    },
    {
      id: 'ngo_5',
      name: 'SecondHelping Food Bank',
      address: '720 Industrial Way, North Hub',
      distanceKm: 5.6,
      acceptedTypes: 'Bulk Dry & Refrigerated Surplus',
      dailyCapacityKg: 300,
      contactPhone: '+1 (555) 918-3300',
      contactEmail: 'logistics@secondhelping.org',
      operatingHours: '08:00 – 19:00 Mon–Sat',
    },
  ];

  const nowIso = new Date().toISOString();
  const surplus: SurplusListing[] = [
    {
      id: 'sur_1',
      title: 'Steamed Jasmine Rice & Herb Pilaf Trays',
      category: 'Grains & Rice',
      quantityKg: 14.5,
      mealType: 'Lunch',
      expiryWindow: 'Today, 18:30',
      storageType: 'Hot Hold',
      status: 'AVAILABLE',
      createdAt: nowIso,
      user: { name: vendorUser.name, organizationName: vendorUser.organizationName },
      pickupRequests: [],
    },
    {
      id: 'sur_2',
      title: 'Artisan Multigrain Rolls & Croissants',
      category: 'Bakery & Pastry',
      quantityKg: 8.0,
      mealType: 'Breakfast',
      expiryWindow: 'Tomorrow, 10:00',
      storageType: 'Ambient',
      status: 'AVAILABLE',
      createdAt: nowIso,
      user: { name: vendorUser.name, organizationName: vendorUser.organizationName },
      pickupRequests: [],
    },
    {
      id: 'sur_3',
      title: 'Grilled Lemon Chicken & Roasted Veg',
      category: 'Proteins & Mains',
      quantityKg: 11.2,
      mealType: 'Lunch',
      expiryWindow: 'Today, 20:00',
      storageType: 'Refrigerated',
      status: 'AVAILABLE',
      createdAt: nowIso,
      user: { name: vendorUser.name, organizationName: vendorUser.organizationName },
      pickupRequests: [],
    },
    {
      id: 'sur_4',
      title: 'Mixed Greens & Chickpea Salad Bowls',
      category: 'Produce & Salads',
      quantityKg: 9.4,
      mealType: 'Dinner',
      expiryWindow: 'Today, 21:30',
      storageType: 'Refrigerated',
      status: 'REQUESTED',
      createdAt: nowIso,
      user: { name: vendorUser.name, organizationName: vendorUser.organizationName },
      pickupRequests: [
        {
          id: 'req_1',
          surplusId: 'sur_4',
          ngoId: ngos[2].id,
          ngo: ngos[2],
          notes: 'Volunteer courier arriving at Loading Bay B',
          status: 'SCHEDULED',
          pickupTime: 'Today, 17:45',
          createdAt: nowIso,
        },
      ],
    },
    {
      id: 'sur_5',
      title: 'Yogurt Parfait Cups & Fruit Trays',
      category: 'Dairy & Desserts',
      quantityKg: 6.5,
      mealType: 'Snacks',
      expiryWindow: 'Yesterday, 19:00',
      storageType: 'Refrigerated',
      status: 'COLLECTED',
      createdAt: nowIso,
      user: { name: vendorUser.name, organizationName: vendorUser.organizationName },
      pickupRequests: [
        {
          id: 'req_2',
          surplusId: 'sur_5',
          ngoId: ngos[0].id,
          ngo: ngos[0],
          notes: 'Collected and signed off by kitchen supervisor',
          status: 'COMPLETED',
          pickupTime: 'Yesterday, 18:10',
          createdAt: nowIso,
        },
      ],
    },
  ];

  return {
    users: [vendorUser, adminUser],
    entries,
    ngos,
    surplus,
    currentUserId: null,
    resetCodes: {},
  };
}

function loadDb(): OfflineDb {
  try {
    const raw = localStorage.getItem(OFFLINE_DB_KEY);
    if (raw) {
      return JSON.parse(raw) as OfflineDb;
    }
  } catch {
    // ignore parse failure
  }
  const fresh = createInitialDb();
  saveDb(fresh);
  return fresh;
}

function saveDb(db: OfflineDb): void {
  try {
    localStorage.setItem(OFFLINE_DB_KEY, JSON.stringify(db));
  } catch {
    // ignore storage quota errors
  }
}

function toPublicUser(u: StoredUser): User {
  const { password: _pw, ...pub } = u;
  return pub;
}

function makeError(message: string, status: number): Error & { status: number } {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

function requireOfflineUser(db: OfflineDb): StoredUser {
  if (!db.currentUserId) throw makeError('Authentication required', 401);
  const found = db.users.find((u) => u.id === db.currentUserId);
  if (!found) throw makeError('Session expired', 401);
  return found;
}

export async function offlineRequest<T>(
  pathWithQuery: string,
  options: RequestInit = {}
): Promise<T> {
  const db = loadDb();
  const method = (options.method || 'GET').toUpperCase();
  const [pathname, queryStr = ''] = pathWithQuery.split('?');
  const params = new URLSearchParams(queryStr);
  const body = options.body ? JSON.parse(String(options.body)) : {};

  // AUTH ROUTES
  if (pathname === '/api/auth/me' && method === 'GET') {
    const user = requireOfflineUser(db);
    return { user: toPublicUser(user) } as T;
  }

  if (pathname === '/api/auth/login' && method === 'POST') {
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const user = db.users.find((u) => u.email.toLowerCase() === email);
    if (!user || user.password !== password) {
      throw makeError('Invalid email or password.', 401);
    }
    db.currentUserId = user.id;
    saveDb(db);
    return { user: toPublicUser(user), token: `offline-${user.id}` } as T;
  }

  if (pathname === '/api/auth/signup' && method === 'POST') {
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const organizationName = String(body.organizationName || '').trim();
    const organizationType = (body.organizationType || 'Canteen') as OrganizationType;

    if (name.length < 2) throw makeError('Full name must be at least 2 characters.', 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw makeError('Invalid email address.', 400);
    if (password.length < 8) throw makeError('Password must be at least 8 characters.', 400);
    if (db.users.some((u) => u.email.toLowerCase() === email)) {
      throw makeError('An account with this email already exists.', 409);
    }

    const created: StoredUser = {
      id: `usr_${Date.now()}`,
      name,
      email,
      password,
      role: 'VENDOR',
      organizationName,
      organizationType,
      wasteAlertThreshold: 12,
      emailAlerts: true,
      surplusAlerts: true,
      dailyDigest: false,
    };
    db.users.push(created);
    db.currentUserId = created.id;
    saveDb(db);
    return { user: toPublicUser(created), token: `offline-${created.id}` } as T;
  }

  if (pathname === '/api/auth/logout' && method === 'POST') {
    db.currentUserId = null;
    saveDb(db);
    return { message: 'Logged out successfully' } as T;
  }

  if (pathname === '/api/auth/forgot-password' && method === 'POST') {
    const email = String(body.email || '').trim().toLowerCase();
    const user = db.users.find((u) => u.email.toLowerCase() === email);
    if (!user) {
      return {
        message: 'If an account matches this email, a reset verification code has been generated.',
        demoResetCode: null,
      } as T;
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    db.resetCodes[email] = code;
    saveDb(db);
    return {
      message: 'Verification code generated (offline simulation).',
      demoResetCode: code,
    } as T;
  }

  if (pathname === '/api/auth/reset-password' && method === 'POST') {
    const email = String(body.email || '').trim().toLowerCase();
    const code = String(body.code || '').trim();
    const newPassword = String(body.newPassword || '');
    if (!db.resetCodes[email] || db.resetCodes[email] !== code) {
      throw makeError('Verification code is invalid or expired.', 400);
    }
    const user = db.users.find((u) => u.email.toLowerCase() === email);
    if (!user) throw makeError('Account not found.', 404);
    user.password = newPassword;
    delete db.resetCodes[email];
    saveDb(db);
    return { message: 'Password updated successfully.' } as T;
  }

  if (pathname === '/api/auth/profile' && method === 'PUT') {
    const user = requireOfflineUser(db);
    user.name = String(body.name || user.name).trim();
    user.organizationName = String(body.organizationName || user.organizationName).trim();
    user.organizationType = (body.organizationType || user.organizationType) as OrganizationType;
    user.wasteAlertThreshold = Number(body.wasteAlertThreshold ?? user.wasteAlertThreshold);
    user.emailAlerts = Boolean(body.emailAlerts);
    user.surplusAlerts = Boolean(body.surplusAlerts);
    user.dailyDigest = Boolean(body.dailyDigest);
    saveDb(db);
    return { user: toPublicUser(user) } as T;
  }

  if (pathname === '/api/auth/password' && method === 'PUT') {
    const user = requireOfflineUser(db);
    if (user.password !== body.currentPassword) {
      throw makeError('Current password is incorrect.', 400);
    }
    user.password = String(body.newPassword || '');
    saveDb(db);
    return { message: 'Password updated successfully.' } as T;
  }

  // ENTRIES & ANALYTICS
  const user = requireOfflineUser(db);
  const filterEntries = () => {
    const startDate = params.get('startDate');
    const endDate = params.get('endDate');
    const mealType = params.get('mealType');
    const category = params.get('category');
    const scope = params.get('scope');
    return db.entries
      .filter((e) => {
        if (!(user.role === 'ADMIN' && scope === 'all') && e.userId !== user.id) return false;
        if (startDate && e.date < startDate) return false;
        if (endDate && e.date > endDate) return false;
        if (mealType && mealType !== 'All' && e.mealType !== mealType) return false;
        if (category && category !== 'All' && e.category !== category) return false;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  };

  if (pathname === '/api/entries' && method === 'GET') {
    return { entries: filterEntries() } as T;
  }

  if (pathname === '/api/entries' && method === 'POST') {
    const preparedKg = Number(body.preparedKg);
    const consumedKg = Number(body.consumedKg);
    const leftoverKg =
      body.leftoverKg !== undefined && body.leftoverKg !== ''
        ? Number(body.leftoverKg)
        : Math.max(0, Number((preparedKg - consumedKg).toFixed(1)));
    const entry: DailyEntry = {
      id: `ent_${Date.now()}`,
      date: body.date,
      mealType: body.mealType,
      category: body.category,
      preparedKg: Number(preparedKg.toFixed(1)),
      consumedKg: Number(consumedKg.toFixed(1)),
      leftoverKg: Number(leftoverKg.toFixed(1)),
      headcount: Math.round(Number(body.headcount) || 1),
      isSpecialEvent: Boolean(body.isSpecialEvent),
      eventLabel: body.isSpecialEvent ? body.eventLabel || null : null,
      costPerKg: Number(body.costPerKg ?? 4.8),
      notes: body.notes || null,
      userId: user.id,
      user: { name: user.name, organizationName: user.organizationName },
    };
    db.entries.unshift(entry);
    saveDb(db);
    return { entry } as T;
  }

  if (pathname.startsWith('/api/entries/') && method === 'DELETE') {
    const id = pathname.replace('/api/entries/', '');
    db.entries = db.entries.filter((e) => e.id !== id);
    saveDb(db);
    return { message: 'Entry deleted' } as T;
  }

  if (pathname === '/api/entries/summary' && method === 'GET') {
    const entries = filterEntries().slice().sort((a, b) => a.date.localeCompare(b.date));
    const totalPreparedKg = entries.reduce((s, e) => s + e.preparedKg, 0);
    const totalConsumedKg = entries.reduce((s, e) => s + e.consumedKg, 0);
    const totalLeftoverKg = entries.reduce((s, e) => s + e.leftoverKg, 0);
    const wastePct = totalPreparedKg > 0 ? (totalLeftoverKg / totalPreparedKg) * 100 : 0;

    const sortedDates = Array.from(new Set(entries.map((e) => e.date))).sort();
    const recentDates = new Set(sortedDates.slice(-14));
    const priorDates = new Set(sortedDates.slice(0, Math.max(0, sortedDates.length - 14)));
    const recent = entries.filter((e) => recentDates.has(e.date));
    const prior = entries.filter((e) => priorDates.has(e.date));

    const recentPrep = recent.reduce((s, e) => s + e.preparedKg, 0);
    const recentWaste = recent.reduce((s, e) => s + e.leftoverKg, 0);
    const recentWasteRate = recentPrep > 0 ? recentWaste / recentPrep : wastePct / 100;
    const priorPrep = prior.reduce((s, e) => s + e.preparedKg, 0);
    const priorWaste = prior.reduce((s, e) => s + e.leftoverKg, 0);
    const baselineWasteRate = priorPrep > 0 ? Math.max(priorWaste / priorPrep, 0.16) : 0.16;
    const avgCost = entries.length > 0 ? entries.reduce((s, e) => s + e.costPerKg, 0) / entries.length : 4.8;
    const savedFoodKg = Math.max(0, (baselineWasteRate - recentWasteRate) * totalPreparedKg + totalLeftoverKg * 0.25);

    const dailyMap = new Map<string, { date: string; preparedKg: number; consumedKg: number; leftoverKg: number; headcount: number }>();
    const catMap = new Map<string, { category: string; preparedKg: number; consumedKg: number; leftoverKg: number }>();
    const mealMap = new Map<string, { mealType: string; preparedKg: number; consumedKg: number; leftoverKg: number }>();

    for (const e of entries) {
      const d = dailyMap.get(e.date) || { date: e.date, preparedKg: 0, consumedKg: 0, leftoverKg: 0, headcount: 0 };
      d.preparedKg += e.preparedKg;
      d.consumedKg += e.consumedKg;
      d.leftoverKg += e.leftoverKg;
      d.headcount = Math.max(d.headcount, e.headcount);
      dailyMap.set(e.date, d);

      const c = catMap.get(e.category) || { category: e.category, preparedKg: 0, consumedKg: 0, leftoverKg: 0 };
      c.preparedKg += e.preparedKg;
      c.consumedKg += e.consumedKg;
      c.leftoverKg += e.leftoverKg;
      catMap.set(e.category, c);

      const m = mealMap.get(e.mealType) || { mealType: e.mealType, preparedKg: 0, consumedKg: 0, leftoverKg: 0 };
      m.preparedKg += e.preparedKg;
      m.consumedKg += e.consumedKg;
      m.leftoverKg += e.leftoverKg;
      mealMap.set(e.mealType, m);
    }

    const dailyTrend = Array.from(dailyMap.values()).map((d) => ({
      ...d,
      preparedKg: Number(d.preparedKg.toFixed(1)),
      consumedKg: Number(d.consumedKg.toFixed(1)),
      leftoverKg: Number(d.leftoverKg.toFixed(1)),
      wastePct: d.preparedKg > 0 ? Number(((d.leftoverKg / d.preparedKg) * 100).toFixed(1)) : 0,
    }));

    return {
      kpis: {
        totalPreparedKg: Number(totalPreparedKg.toFixed(1)),
        totalConsumedKg: Number(totalConsumedKg.toFixed(1)),
        totalLeftoverKg: Number(totalLeftoverKg.toFixed(1)),
        wastePct: Number(wastePct.toFixed(1)),
        recentWastePct: Number((recentWasteRate * 100).toFixed(1)),
        moneySavedUsd: Number((savedFoodKg * avgCost).toFixed(0)),
        co2AvoidedKg: Number((savedFoodKg * CO2_KG_PER_FOOD_KG).toFixed(1)),
        entryCount: entries.length,
        daysTracked: sortedDates.length,
      },
      dailyTrend,
      weeklyTrend: dailyTrend.slice(-14),
      byCategory: Array.from(catMap.values())
        .map((c) => ({
          ...c,
          preparedKg: Number(c.preparedKg.toFixed(1)),
          consumedKg: Number(c.consumedKg.toFixed(1)),
          leftoverKg: Number(c.leftoverKg.toFixed(1)),
          wastePct: c.preparedKg > 0 ? Number(((c.leftoverKg / c.preparedKg) * 100).toFixed(1)) : 0,
        }))
        .sort((a, b) => b.leftoverKg - a.leftoverKg),
      byMealType: Array.from(mealMap.values()).map((m) => ({
        ...m,
        preparedKg: Number(m.preparedKg.toFixed(1)),
        consumedKg: Number(m.consumedKg.toFixed(1)),
        leftoverKg: Number(m.leftoverKg.toFixed(1)),
        wastePct: m.preparedKg > 0 ? Number(((m.leftoverKg / m.preparedKg) * 100).toFixed(1)) : 0,
      })),
    } as T;
  }

  // PREDICTIONS
  if (pathname === '/api/predictions/forecast' && method === 'GET') {
    const mealType = params.get('mealType') || 'All';
    const days = Math.min(14, Math.max(1, Number(params.get('days')) || 7));
    const isSpecialEvent = params.get('specialEvent') === 'true';
    const eventLabel = params.get('eventLabel') || '';
    const userEntries = db.entries.filter((e) => e.userId === user.id);
    const tomorrowIso = addDaysISO(new Date().toISOString().slice(0, 10), 1);
    const eventDates: Record<string, string> = {};
    if (isSpecialEvent) eventDates[tomorrowIso] = eventLabel || 'Scheduled Special Event';

    return {
      tomorrow: predictForDate(userEntries, {
        targetDate: tomorrowIso,
        mealType,
        isSpecialEvent,
        eventLabel,
        wasteAlertThresholdPct: user.wasteAlertThreshold,
      }),
      horizon: predictHorizon(userEntries, tomorrowIso, days, mealType, eventDates, user.wasteAlertThreshold),
      tomorrowByMeal: ['Breakfast', 'Lunch', 'Dinner', 'Snacks'].map((m) =>
        predictForDate(userEntries, {
          targetDate: tomorrowIso,
          mealType: m,
          isSpecialEvent,
          eventLabel,
          wasteAlertThresholdPct: user.wasteAlertThreshold,
        })
      ),
      thresholdPct: user.wasteAlertThreshold,
      historySamples: userEntries.length,
    } as T;
  }

  // SURPLUS
  if (pathname === '/api/surplus' && method === 'GET') {
    return { listings: db.surplus, ngos: db.ngos } as T;
  }

  if (pathname === '/api/surplus' && method === 'POST') {
    const listing: SurplusListing = {
      id: `sur_${Date.now()}`,
      title: String(body.title || ''),
      category: String(body.category || 'Grains & Rice'),
      quantityKg: Number(body.quantityKg) || 5,
      mealType: String(body.mealType || 'Lunch'),
      expiryWindow: String(body.expiryWindow || 'Today, 20:00'),
      storageType: String(body.storageType || 'Refrigerated'),
      status: 'AVAILABLE',
      createdAt: new Date().toISOString(),
      user: { name: user.name, organizationName: user.organizationName },
      pickupRequests: [],
    };
    db.surplus.unshift(listing);
    saveDb(db);
    return { listing } as T;
  }

  if (pathname.endsWith('/request-pickup') && method === 'POST') {
    const id = pathname.split('/')[3];
    const listing = db.surplus.find((s) => s.id === id);
    const ngo = db.ngos.find((n) => n.id === body.ngoId) || db.ngos[0];
    if (!listing) throw makeError('Surplus listing not found', 404);
    listing.status = 'REQUESTED';
    listing.pickupRequests.unshift({
      id: `req_${Date.now()}`,
      surplusId: listing.id,
      ngoId: ngo.id,
      ngo,
      notes: body.notes || null,
      status: 'SCHEDULED',
      pickupTime: body.pickupTime || 'Today, 18:00',
      createdAt: new Date().toISOString(),
    });
    saveDb(db);
    return { listing } as T;
  }

  if (pathname.endsWith('/collect') && method === 'PATCH') {
    const id = pathname.split('/')[3];
    const listing = db.surplus.find((s) => s.id === id);
    if (!listing) throw makeError('Surplus listing not found', 404);
    listing.status = 'COLLECTED';
    listing.pickupRequests.forEach((r) => {
      r.status = 'COMPLETED';
    });
    saveDb(db);
    return { listing } as T;
  }

  // ALERTS
  if (pathname === '/api/alerts' && method === 'GET') {
    const userEntries = db.entries.filter((e) => e.userId === user.id);
    const threshold = user.wasteAlertThreshold;
    const todayIso = new Date().toISOString().slice(0, 10);
    const tomorrowIso = addDaysISO(todayIso, 1);
    const alerts: WasteAlertItem[] = [];

    for (const meal of ['Breakfast', 'Lunch', 'Dinner', 'Snacks']) {
      const forecast = predictHorizon(userEntries, tomorrowIso, 7, meal, {}, threshold);
      for (const day of forecast) {
        if (day.expectedWasteWithCurrentHabitPct >= threshold) {
          const excessKg = Number(Math.max(0, day.baselinePrepKg - day.predictedConsumedKg).toFixed(1));
          alerts.push({
            id: `pred-${day.date}-${meal}`,
            severity: day.expectedWasteWithCurrentHabitPct >= threshold + 4 ? 'CRITICAL' : 'WARNING',
            source: 'PREDICTION',
            date: day.date,
            mealType: meal,
            wastePct: day.expectedWasteWithCurrentHabitPct,
            thresholdPct: threshold,
            estimatedExcessKg: excessKg,
            title: `${meal} prep projected at ${day.expectedWasteWithCurrentHabitPct}% waste on ${day.dayName}`,
            recommendation: `Lower batch prep from ${day.baselinePrepKg} kg to ${day.recommendedPrepKg} kg to save ~${Math.max(0.5, Number((day.baselinePrepKg - day.recommendedPrepKg).toFixed(1)))} kg.`,
          });
        }
      }
    }

    return { thresholdPct: threshold, alerts } as T;
  }

  if (pathname === '/api/alerts/threshold' && method === 'PUT') {
    user.wasteAlertThreshold = Number(body.thresholdPct) || 12;
    saveDb(db);
    return { thresholdPct: user.wasteAlertThreshold } as T;
  }

  // ADMIN
  if (pathname === '/api/admin/organizations' && method === 'GET') {
    if (user.role !== 'ADMIN') throw makeError('Admin access required', 403);
    const organizations: AdminOrganization[] = db.users.map((u) => {
      const ue = db.entries.filter((e) => e.userId === u.id);
      const prepared = ue.reduce((s, e) => s + e.preparedKg, 0);
      const leftover = ue.reduce((s, e) => s + e.leftoverKg, 0);
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        organizationName: u.organizationName,
        organizationType: u.organizationType,
        wasteAlertThreshold: u.wasteAlertThreshold,
        totalEntries: ue.length,
        totalPreparedKg: Number(prepared.toFixed(1)),
        totalLeftoverKg: Number(leftover.toFixed(1)),
        wastePct: prepared > 0 ? Number(((leftover / prepared) * 100).toFixed(1)) : 0,
        surplusCount: db.surplus.length,
        pickupCount: 2,
      };
    });
    return { organizations } as T;
  }

  throw makeError(`Offline endpoint not supported: ${pathname}`, 404);
}

export function offlineExportCsv(pathWithQuery: string): string {
  const db = loadDb();
  const [, queryStr = ''] = pathWithQuery.split('?');
  const params = new URLSearchParams(queryStr);
  const startDate = params.get('startDate');
  const endDate = params.get('endDate');
  const mealType = params.get('mealType');

  const entries = db.entries.filter((e) => {
    if (db.currentUserId && e.userId !== db.currentUserId) return false;
    if (startDate && e.date < startDate) return false;
    if (endDate && e.date > endDate) return false;
    if (mealType && mealType !== 'All' && e.mealType !== mealType) return false;
    return true;
  });

  const header =
    'Date,Meal Type,Category,Prepared (kg),Consumed (kg),Leftover (kg),Waste %,Headcount,Special Event,Event Label,Cost Per Kg ($)\n';
  const rows = entries
    .map((e) => {
      const wPct = e.preparedKg > 0 ? ((e.leftoverKg / e.preparedKg) * 100).toFixed(1) : '0.0';
      return `${e.date},"${e.mealType}","${e.category}",${e.preparedKg},${e.consumedKg},${e.leftoverKg},${wPct},${e.headcount},${e.isSpecialEvent ? 'Yes' : 'No'},"${e.eventLabel || ''}",${e.costPerKg}`;
    })
    .join('\n');

  return header + rows;
}
