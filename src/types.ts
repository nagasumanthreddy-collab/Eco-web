export type UserRole = 'ADMIN' | 'VENDOR';
export type OrganizationType = 'Restaurant' | 'Hostel' | 'Canteen' | 'Event';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organizationName: string;
  organizationType: OrganizationType;
  wasteAlertThreshold: number;
  emailAlerts: boolean;
  surplusAlerts: boolean;
  dailyDigest: boolean;
}

export interface DailyEntry {
  id: string;
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
  user?: {
    name: string;
    organizationName: string;
  };
}

export interface DashboardSummary {
  kpis: {
    totalPreparedKg: number;
    totalConsumedKg: number;
    totalLeftoverKg: number;
    wastePct: number;
    recentWastePct: number;
    moneySavedUsd: number;
    co2AvoidedKg: number;
    entryCount: number;
    daysTracked: number;
  };
  dailyTrend: Array<{
    date: string;
    preparedKg: number;
    consumedKg: number;
    leftoverKg: number;
    headcount: number;
    wastePct: number;
  }>;
  weeklyTrend: Array<{
    date: string;
    preparedKg: number;
    consumedKg: number;
    leftoverKg: number;
    headcount: number;
    wastePct: number;
  }>;
  byCategory: Array<{
    category: string;
    preparedKg: number;
    consumedKg: number;
    leftoverKg: number;
    wastePct: number;
  }>;
  byMealType: Array<{
    mealType: string;
    preparedKg: number;
    consumedKg: number;
    leftoverKg: number;
    wastePct: number;
  }>;
}

export interface ForecastFactor {
  label: string;
  impactPct: number;
  detail: string;
}

export interface DayForecast {
  date: string;
  dayName: string;
  mealType: string;
  predictedConsumedKg: number;
  recommendedPrepKg: number;
  baselinePrepKg: number;
  expectedWasteWithCurrentHabitPct: number;
  expectedWasteWithRecommendedPct: number;
  confidenceLowKg: number;
  confidenceHighKg: number;
  confidenceLevelPct: number;
  predictedHeadcount: number;
  isSpecialEvent: boolean;
  eventLabel: string | null;
  alertTriggered: boolean;
  explanation: string;
  factors: ForecastFactor[];
}

export interface ForecastResponse {
  tomorrow: DayForecast;
  horizon: DayForecast[];
  tomorrowByMeal: DayForecast[];
  thresholdPct: number;
  historySamples: number;
}

export interface NgoPartner {
  id: string;
  name: string;
  address: string;
  distanceKm: number;
  acceptedTypes: string;
  dailyCapacityKg: number;
  contactPhone: string;
  contactEmail: string;
  operatingHours: string;
}

export interface PickupRequest {
  id: string;
  surplusId: string;
  ngoId: string;
  ngo: NgoPartner;
  notes: string | null;
  status: string;
  pickupTime: string;
  createdAt: string;
}

export interface SurplusListing {
  id: string;
  title: string;
  category: string;
  quantityKg: number;
  mealType: string;
  expiryWindow: string;
  storageType: string;
  status: 'AVAILABLE' | 'REQUESTED' | 'COLLECTED';
  createdAt: string;
  user?: {
    name: string;
    organizationName: string;
  };
  pickupRequests: PickupRequest[];
}

export interface WasteAlertItem {
  id: string;
  severity: 'CRITICAL' | 'WARNING';
  source: 'PREDICTION' | 'HISTORICAL';
  date: string;
  mealType: string;
  wastePct: number;
  thresholdPct: number;
  estimatedExcessKg: number;
  title: string;
  recommendation: string;
}

export interface AdminOrganization {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organizationName: string;
  organizationType: string;
  wasteAlertThreshold: number;
  totalEntries: number;
  totalPreparedKg: number;
  totalLeftoverKg: number;
  wastePct: number;
  surplusCount: number;
  pickupCount: number;
}
