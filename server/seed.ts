import { prisma } from './db.ts';
import { hashPassword } from './utils/authUtils.ts';

function formatDateISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Deterministic pseudo-random helper so seeded metrics look crisp & repeatable
function seededNoise(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

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
  0: 0.88, // Sun
  1: 0.96, // Mon
  2: 0.99, // Tue
  3: 1.02, // Wed
  4: 1.05, // Thu
  5: 1.15, // Fri
  6: 0.97, // Sat
};

export async function ensureSeeded(): Promise<void> {
  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) return;

  console.log('Seeding EcoPredict SQLite database with 60 days of operational history...');

  const vendorPasswordHash = await hashPassword('Vendor@1234');
  const adminPasswordHash = await hashPassword('Admin@1234');

  const vendorUser = await prisma.user.create({
    data: {
      name: 'Maya Lin',
      email: 'vendor@ecopredict.io',
      passwordHash: vendorPasswordHash,
      role: 'VENDOR',
      organizationName: 'GreenPlate Campus Canteen',
      organizationType: 'Canteen',
      wasteAlertThreshold: 11.5,
      emailAlerts: true,
      surplusAlerts: true,
      dailyDigest: true,
    },
  });

  const adminUser = await prisma.user.create({
    data: {
      name: 'Arjun Mehta',
      email: 'admin@ecopredict.io',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      organizationName: 'Metro Dining Operations',
      organizationType: 'Restaurant',
      wasteAlertThreshold: 10.0,
      emailAlerts: true,
      surplusAlerts: true,
      dailyDigest: true,
    },
  });

  const today = new Date();
  today.setUTCHours(12, 0, 0, 0);

  const entriesToCreate: Array<{
    date: string;
    mealType: string;
    category: string;
    preparedKg: number;
    consumedKg: number;
    leftoverKg: number;
    headcount: number;
    isSpecialEvent: boolean;
    eventLabel: string | null;
    costPerKg: number;
    notes: string | null;
    userId: string;
  }> = [];

  for (let dayOffset = 59; dayOffset >= 0; dayOffset--) {
    const dt = new Date(today);
    dt.setUTCDate(today.getUTCDate() - dayOffset);
    const dateStr = formatDateISO(dt);
    const dow = dt.getUTCDay();
    const dowMultiplier = WEEKDAY_MULTIPLIERS[dow] ?? 1.0;

    const eventLabel = SPECIAL_EVENTS[dayOffset] ?? null;
    const isSpecialEvent = Boolean(eventLabel);
    const eventMultiplier = isSpecialEvent ? 1.19 : 1.0;

    // Slight waste-reduction learning curve over the 60 days (from ~16% down to ~8.5% recently)
    const improvementFactor = 0.165 - ((59 - dayOffset) / 59) * 0.08;

    for (let idx = 0; idx < MEAL_CONFIGS.length; idx++) {
      const cfg = MEAL_CONFIGS[idx];
      const noise = (seededNoise(dayOffset * 17 + idx * 31) - 0.5) * 0.12;
      const consumedKg = Number(
        Math.max(
          8,
          cfg.baseConsumed * dowMultiplier * eventMultiplier * (1 + noise)
        ).toFixed(1)
      );

      // Simulate occasional higher waste on Fridays or Bakery to trigger meaningful analytics/alerts
      const wasteSpike =
        (dow === 5 && idx === 1 ? 0.05 : 0) +
        (idx === 0 ? 0.035 : 0) +
        (seededNoise(dayOffset * 7 + idx) - 0.4) * 0.04;
      const wasteRatio = Math.max(0.03, improvementFactor + wasteSpike);
      const preparedKg = Number((consumedKg / (1 - wasteRatio)).toFixed(1));
      const leftoverKg = Number(Math.max(0, preparedKg - consumedKg).toFixed(1));
      const headcount = Math.round(
        cfg.baseHeadcount * dowMultiplier * eventMultiplier * (1 + noise * 0.7)
      );

      entriesToCreate.push({
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
      });

      // Seed paired entries for admin's multi-kitchen restaurant dataset (scaled slightly)
      if (idx < 3) {
        const adminConsumed = Number((consumedKg * 0.82).toFixed(1));
        const adminPrepared = Number((adminConsumed / (1 - wasteRatio * 0.92)).toFixed(1));
        entriesToCreate.push({
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
        });
      }
    }
  }

  await prisma.dailyEntry.createMany({ data: entriesToCreate });

  const ngos = await Promise.all([
    prisma.ngoPartner.create({
      data: {
        name: 'City Harvest Community Kitchen',
        address: '412 Market Street, Downtown District',
        distanceKm: 1.8,
        acceptedTypes: 'Cooked Meals, Grains & Rice, Produce',
        dailyCapacityKg: 140,
        contactPhone: '+1 (555) 234-8910',
        contactEmail: 'dispatch@cityharvest.org',
        operatingHours: '07:00 – 22:00 daily',
      },
    }),
    prisma.ngoPartner.create({
      data: {
        name: 'Mercy Meal Rescue Network',
        address: '88 Oakridge Avenue, East Campus',
        distanceKm: 2.9,
        acceptedTypes: 'Hot Mains, Bakery & Pastry, Dairy',
        dailyCapacityKg: 95,
        contactPhone: '+1 (555) 392-4411',
        contactEmail: 'rescue@mercymeals.org',
        operatingHours: '08:30 – 21:00 daily',
      },
    }),
    prisma.ngoPartner.create({
      data: {
        name: 'GreenBite Neighborhood Fridge',
        address: '19 Cedar Lane, University Quarter',
        distanceKm: 1.1,
        acceptedTypes: 'Packaged Salads, Bakery, Fresh Produce',
        dailyCapacityKg: 55,
        contactPhone: '+1 (555) 781-0932',
        contactEmail: 'hello@greenbitefridge.org',
        operatingHours: '24/7 refrigerated drop-off',
      },
    }),
    prisma.ngoPartner.create({
      data: {
        name: 'Sunrise Youth & Family Shelter',
        address: '305 Elm Boulevard, Westside',
        distanceKm: 4.4,
        acceptedTypes: 'All Prepared Meals, Grains, Proteins',
        dailyCapacityKg: 180,
        contactPhone: '+1 (555) 640-2277',
        contactEmail: 'kitchen@sunriseshelter.org',
        operatingHours: '06:30 – 20:30 daily',
      },
    }),
    prisma.ngoPartner.create({
      data: {
        name: 'SecondHelping Food Bank',
        address: '720 Industrial Way, North Hub',
        distanceKm: 5.6,
        acceptedTypes: 'Bulk Dry & Refrigerated Surplus',
        dailyCapacityKg: 300,
        contactPhone: '+1 (555) 918-3300',
        contactEmail: 'logistics@secondhelping.org',
        operatingHours: '08:00 – 19:00 Mon–Sat',
      },
    }),
  ]);

  const s1 = await prisma.surplusListing.create({
    data: {
      title: 'Steamed Jasmine Rice & Herb Pilaf Trays',
      category: 'Grains & Rice',
      quantityKg: 14.5,
      mealType: 'Lunch',
      expiryWindow: 'Today, 18:30',
      storageType: 'Hot Hold',
      status: 'AVAILABLE',
      userId: vendorUser.id,
    },
  });

  const s2 = await prisma.surplusListing.create({
    data: {
      title: 'Artisan Multigrain Rolls & Croissants',
      category: 'Bakery & Pastry',
      quantityKg: 8.0,
      mealType: 'Breakfast',
      expiryWindow: 'Tomorrow, 10:00',
      storageType: 'Ambient',
      status: 'AVAILABLE',
      userId: vendorUser.id,
    },
  });

  await prisma.surplusListing.create({
    data: {
      title: 'Grilled Lemon Chicken & Roasted Veg',
      category: 'Proteins & Mains',
      quantityKg: 11.2,
      mealType: 'Lunch',
      expiryWindow: 'Today, 20:00',
      storageType: 'Refrigerated',
      status: 'AVAILABLE',
      userId: vendorUser.id,
    },
  });

  const s4 = await prisma.surplusListing.create({
    data: {
      title: 'Mixed Greens & Chickpea Salad Bowls',
      category: 'Produce & Salads',
      quantityKg: 9.4,
      mealType: 'Dinner',
      expiryWindow: 'Today, 21:30',
      storageType: 'Refrigerated',
      status: 'REQUESTED',
      userId: vendorUser.id,
    },
  });

  const s5 = await prisma.surplusListing.create({
    data: {
      title: 'Yogurt Parfait Cups & Fruit Trays',
      category: 'Dairy & Desserts',
      quantityKg: 6.5,
      mealType: 'Snacks',
      expiryWindow: 'Yesterday, 19:00',
      storageType: 'Refrigerated',
      status: 'COLLECTED',
      userId: vendorUser.id,
    },
  });

  await prisma.pickupRequest.create({
    data: {
      surplusId: s4.id,
      ngoId: ngos[2].id,
      userId: vendorUser.id,
      notes: 'Volunteer courier arriving at Loading Bay B',
      status: 'SCHEDULED',
      pickupTime: 'Today, 17:45',
    },
  });

  await prisma.pickupRequest.create({
    data: {
      surplusId: s5.id,
      ngoId: ngos[0].id,
      userId: vendorUser.id,
      notes: 'Collected and signed off by kitchen supervisor',
      status: 'COMPLETED',
      pickupTime: 'Yesterday, 18:10',
    },
  });

  // Also give admin 1 available listing so admin view has surplus items too
  await prisma.surplusListing.create({
    data: {
      title: 'Banquet Pasta Primavera & Garlic Bread',
      category: 'Grains & Rice',
      quantityKg: 16.0,
      mealType: 'Dinner',
      expiryWindow: 'Today, 21:00',
      storageType: 'Hot Hold',
      status: 'AVAILABLE',
      userId: adminUser.id,
    },
  });

  void s1;
  void s2;
  console.log('EcoPredict database seeded successfully.');
}
