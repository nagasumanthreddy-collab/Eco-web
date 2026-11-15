export interface HistoricalEntry {
  date: string; // YYYY-MM-DD
  mealType: string;
  preparedKg: number;
  consumedKg: number;
  leftoverKg: number;
  headcount: number;
  isSpecialEvent: boolean;
  eventLabel?: string | null;
}

export interface ForecastInput {
  targetDate: string; // YYYY-MM-DD
  mealType: string; // "All" | "Breakfast" | "Lunch" | "Dinner" | "Snacks"
  isSpecialEvent?: boolean;
  eventLabel?: string;
  wasteAlertThresholdPct?: number;
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

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

// Sensible baseline weekday demand priors when history has < 2 samples for a weekday
const DEFAULT_WEEKDAY_PRIORS: Record<number, number> = {
  0: 0.90, // Sunday
  1: 0.96, // Monday
  2: 0.98, // Tuesday
  3: 1.01, // Wednesday
  4: 1.03, // Thursday
  5: 1.12, // Friday
  6: 1.00, // Saturday
};

function parseIsoDateUTC(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

export function addDaysISO(dateStr: string, days: number): string {
  const dt = parseIsoDateUTC(dateStr);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/**
 * Aggregates raw entries by date so multiple category entries on the same day/meal
 * combine cleanly into a daily service total.
 */
function aggregateDailySeries(
  entries: HistoricalEntry[],
  mealType: string
): Array<{
  date: string;
  dayOfWeek: number;
  preparedKg: number;
  consumedKg: number;
  leftoverKg: number;
  headcount: number;
  isSpecialEvent: boolean;
}> {
  const filtered =
    mealType === 'All'
      ? entries
      : entries.filter((e) => e.mealType === mealType);

  const byDate = new Map<
    string,
    {
      date: string;
      dayOfWeek: number;
      preparedKg: number;
      consumedKg: number;
      leftoverKg: number;
      headcount: number;
      isSpecialEvent: boolean;
    }
  >();

  for (const row of filtered) {
    const existing = byDate.get(row.date);
    if (existing) {
      existing.preparedKg += row.preparedKg;
      existing.consumedKg += row.consumedKg;
      existing.leftoverKg += row.leftoverKg;
      existing.headcount = Math.max(existing.headcount, row.headcount);
      existing.isSpecialEvent = existing.isSpecialEvent || row.isSpecialEvent;
    } else {
      const dt = parseIsoDateUTC(row.date);
      byDate.set(row.date, {
        date: row.date,
        dayOfWeek: dt.getUTCDay(),
        preparedKg: row.preparedKg,
        consumedKg: row.consumedKg,
        leftoverKg: row.leftoverKg,
        headcount: row.headcount,
        isSpecialEvent: row.isSpecialEvent,
      });
    }
  }

  return Array.from(byDate.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );
}

/**
 * Predicts daily demand using:
 * 1) Exponentially weighted moving average (WMA) over normalized non-event demand
 * 2) Empirical day-of-week seasonality multiplier
 * 3) Empirical special-event uplift factor (+18% prior blended with observed events)
 * 4) Weighted residual std-dev for 90% confidence intervals
 */
export function predictForDate(
  entries: HistoricalEntry[],
  input: ForecastInput
): DayForecast {
  const thresholdPct = input.wasteAlertThresholdPct ?? 12;
  const series = aggregateDailySeries(entries, input.mealType);
  const targetDt = parseIsoDateUTC(input.targetDate);
  const targetDow = targetDt.getUTCDay();
  const dayName = WEEKDAY_NAMES[targetDow];

  if (series.length === 0) {
    const fallbackConsumed = input.mealType === 'All' ? 120 : 40;
    const eventBoost = input.isSpecialEvent ? 1.18 : 1.0;
    const dowFactor = DEFAULT_WEEKDAY_PRIORS[targetDow] ?? 1.0;
    const predConsumed = Number((fallbackConsumed * dowFactor * eventBoost).toFixed(1));
    const recPrep = Number((predConsumed * 1.04).toFixed(1));
    return {
      date: input.targetDate,
      dayName,
      mealType: input.mealType,
      predictedConsumedKg: predConsumed,
      recommendedPrepKg: recPrep,
      baselinePrepKg: Number((predConsumed * 1.12).toFixed(1)),
      expectedWasteWithCurrentHabitPct: 10.7,
      expectedWasteWithRecommendedPct: 3.8,
      confidenceLowKg: Number((predConsumed * 0.88).toFixed(1)),
      confidenceHighKg: Number((predConsumed * 1.12).toFixed(1)),
      confidenceLevelPct: 90,
      predictedHeadcount: Math.round(predConsumed * 2.4),
      isSpecialEvent: Boolean(input.isSpecialEvent),
      eventLabel: input.eventLabel || null,
      alertTriggered: false,
      explanation: `${dayName} baseline prior${input.isSpecialEvent ? ' + Special Event (+18%)' : ''}`,
      factors: [
        {
          label: 'Day-of-week seasonality',
          impactPct: Math.round((dowFactor - 1) * 100),
          detail: `${dayName} default demand pattern`,
        },
        ...(input.isSpecialEvent
          ? [
              {
                label: 'Special event uplift',
                impactPct: 18,
                detail: input.eventLabel || 'Scheduled special event',
              },
            ]
          : []),
      ],
    };
  }

  // Estimate empirical special-event uplift from history
  const regularDays = series.filter((d) => !d.isSpecialEvent);
  const eventDays = series.filter((d) => d.isSpecialEvent);
  const regularMean =
    regularDays.length > 0
      ? regularDays.reduce((acc, d) => acc + d.consumedKg, 0) / regularDays.length
      : series.reduce((acc, d) => acc + d.consumedKg, 0) / series.length;

  let observedEventUplift = 1.18;
  if (eventDays.length >= 2 && regularMean > 0) {
    const eventMean =
      eventDays.reduce((acc, d) => acc + d.consumedKg, 0) / eventDays.length;
    const rawUplift = eventMean / regularMean;
    observedEventUplift = Math.min(1.4, Math.max(1.05, rawUplift));
  }

  // Normalize series by stripping out historical event uplift so WMA learns true base demand
  const recentWindow = series.slice(-28);
  let weightedConsumedSum = 0;
  let weightedPrepRatioSum = 0;
  let weightedHeadcountSum = 0;
  let weightTotal = 0;

  for (let i = 0; i < recentWindow.length; i++) {
    const item = recentWindow[i];
    // Exponential recency weight: newest day gets highest weight
    const weight = Math.pow(1.08, i);
    const normalizedConsumed = item.isSpecialEvent
      ? item.consumedKg / observedEventUplift
      : item.consumedKg;
    const prepRatio =
      item.consumedKg > 0 ? item.preparedKg / item.consumedKg : 1.1;

    weightedConsumedSum += normalizedConsumed * weight;
    weightedPrepRatioSum += prepRatio * weight;
    weightedHeadcountSum +=
      (item.isSpecialEvent ? item.headcount / observedEventUplift : item.headcount) *
      weight;
    weightTotal += weight;
  }

  const wmaBaseConsumed = weightedConsumedSum / weightTotal;
  const avgHabitPrepRatio = Math.min(1.38, Math.max(1.04, weightedPrepRatioSum / weightTotal));
  const wmaBaseHeadcount = weightedHeadcountSum / weightTotal;

  // Empirical day-of-week factor from normalized regular days
  const dowSamples = regularDays.filter((d) => d.dayOfWeek === targetDow);
  let dowFactor = DEFAULT_WEEKDAY_PRIORS[targetDow] ?? 1.0;
  if (dowSamples.length >= 2 && regularMean > 0) {
    const dowMean =
      dowSamples.reduce((acc, d) => acc + d.consumedKg, 0) / dowSamples.length;
    const empiricalDow = dowMean / regularMean;
    // Blend 75% empirical with 25% prior for stability
    dowFactor = Math.min(
      1.35,
      Math.max(0.75, empiricalDow * 0.75 + dowFactor * 0.25)
    );
  }

  const eventFactor = input.isSpecialEvent ? observedEventUplift : 1.0;
  const predictedConsumedKg = Number(
    (wmaBaseConsumed * dowFactor * eventFactor).toFixed(1)
  );
  const baselinePrepKg = Number(
    (predictedConsumedKg * avgHabitPrepRatio).toFixed(1)
  );
  // Optimal prep adds a disciplined 4% safety buffer
  const recommendedPrepKg = Number((predictedConsumedKg * 1.04).toFixed(1));

  // Weighted residual standard deviation for confidence band
  let residualSqSum = 0;
  for (let i = 0; i < recentWindow.length; i++) {
    const item = recentWindow[i];
    const weight = Math.pow(1.08, i);
    const expectedForItem =
      wmaBaseConsumed *
      (DEFAULT_WEEKDAY_PRIORS[item.dayOfWeek] ?? 1.0) *
      (item.isSpecialEvent ? observedEventUplift : 1.0);
    const diff = item.consumedKg - expectedForItem;
    residualSqSum += weight * diff * diff;
  }
  const stdDev = Math.sqrt(residualSqSum / weightTotal);
  const margin = Math.max(predictedConsumedKg * 0.05, 1.45 * stdDev);
  const confidenceLowKg = Number(Math.max(0, predictedConsumedKg - margin).toFixed(1));
  const confidenceHighKg = Number((predictedConsumedKg + margin).toFixed(1));

  const expectedWasteWithCurrentHabitPct = Number(
    Math.max(0, ((baselinePrepKg - predictedConsumedKg) / baselinePrepKg) * 100).toFixed(1)
  );
  const expectedWasteWithRecommendedPct = Number(
    (((recommendedPrepKg - predictedConsumedKg) / recommendedPrepKg) * 100).toFixed(1)
  );

  const dowImpactPct = Math.round((dowFactor - 1) * 100);
  const eventImpactPct = input.isSpecialEvent
    ? Math.round((observedEventUplift - 1) * 100)
    : 0;
  const netImpactPct = Math.round((dowFactor * eventFactor - 1) * 100);

  const factors: ForecastFactor[] = [
    {
      label: `${dayName} Seasonality`,
      impactPct: dowImpactPct,
      detail: `${dowSamples.length} historical ${dayName} services analyzed`,
    },
  ];

  if (input.isSpecialEvent) {
    factors.push({
      label: input.eventLabel?.trim() ? input.eventLabel.trim() : 'Special Event / Holiday',
      impactPct: eventImpactPct,
      detail: `Derived from ${eventDays.length} prior event days`,
    });
  }

  const trendSign = (n: number) => (n >= 0 ? `+${n}%` : `${n}%`);
  const explanationParts = [`${dayName} (${trendSign(dowImpactPct)} weekday pattern)`];
  if (input.isSpecialEvent) {
    explanationParts.push(
      `${input.eventLabel?.trim() || 'Special Event'} (${trendSign(eventImpactPct)})`
    );
  }
  const explanation = `${explanationParts.join(' + ')} = ${trendSign(netImpactPct)} net demand vs. 28-day weighted baseline`;

  const alertTriggered = expectedWasteWithCurrentHabitPct >= thresholdPct;

  return {
    date: input.targetDate,
    dayName,
    mealType: input.mealType,
    predictedConsumedKg,
    recommendedPrepKg,
    baselinePrepKg,
    expectedWasteWithCurrentHabitPct,
    expectedWasteWithRecommendedPct,
    confidenceLowKg,
    confidenceHighKg,
    confidenceLevelPct: 90,
    predictedHeadcount: Math.max(
      1,
      Math.round(wmaBaseHeadcount * dowFactor * eventFactor)
    ),
    isSpecialEvent: Boolean(input.isSpecialEvent),
    eventLabel: input.eventLabel?.trim() || null,
    alertTriggered,
    explanation,
    factors,
  };
}

export function predictHorizon(
  entries: HistoricalEntry[],
  startDate: string,
  days: number,
  mealType: string,
  eventDates: Record<string, string> = {},
  wasteAlertThresholdPct = 12
): DayForecast[] {
  const results: DayForecast[] = [];
  for (let i = 0; i < days; i++) {
    const targetDate = addDaysISO(startDate, i);
    const eventLabel = eventDates[targetDate];
    const isSpecialEvent = Boolean(eventLabel);
    results.push(
      predictForDate(entries, {
        targetDate,
        mealType,
        isSpecialEvent,
        eventLabel,
        wasteAlertThresholdPct,
      })
    );
  }
  return results;
}
