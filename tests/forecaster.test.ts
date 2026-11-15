import { describe, expect, it } from 'vitest';
import { addDaysISO, predictForDate, predictHorizon, type HistoricalEntry } from '../ml/forecaster.ts';

function buildSampleHistory(days = 28): HistoricalEntry[] {
  const entries: HistoricalEntry[] = [];
  const start = '2026-10-01';
  for (let i = 0; i < days; i++) {
    const date = addDaysISO(start, i);
    const dt = new Date(`${date}T12:00:00Z`);
    const isFriday = dt.getUTCDay() === 5;
    const isEvent = i === 10 || i === 24;
    const baseConsumed = 100 * (isFriday ? 1.15 : 1.0) * (isEvent ? 1.2 : 1.0);
    const preparedKg = Number((baseConsumed * 1.12).toFixed(1));
    const consumedKg = Number(baseConsumed.toFixed(1));
    entries.push({
      date,
      mealType: 'Lunch',
      preparedKg,
      consumedKg,
      leftoverKg: Number((preparedKg - consumedKg).toFixed(1)),
      headcount: Math.round(consumedKg * 3),
      isSpecialEvent: isEvent,
      eventLabel: isEvent ? 'Campus Event' : null,
    });
  }
  return entries;
}

describe('EcoPredict Weighted Forecasting Engine', () => {
  it('computes realistic prediction with confidence bounds and explanation text', () => {
    const history = buildSampleHistory(28);
    const forecast = predictForDate(history, {
      targetDate: '2026-10-30', // Friday
      mealType: 'Lunch',
      isSpecialEvent: false,
    });

    expect(forecast.dayName).toBe('Friday');
    expect(forecast.predictedConsumedKg).toBeGreaterThan(100);
    expect(forecast.recommendedPrepKg).toBeGreaterThan(forecast.predictedConsumedKg);
    expect(forecast.confidenceLowKg).toBeLessThan(forecast.predictedConsumedKg);
    expect(forecast.confidenceHighKg).toBeGreaterThan(forecast.predictedConsumedKg);
    expect(forecast.explanation).toContain('Friday');
  });

  it('applies special-event uplift and documents it in explanation factors', () => {
    const history = buildSampleHistory(28);
    const regular = predictForDate(history, {
      targetDate: '2026-10-30',
      mealType: 'Lunch',
      isSpecialEvent: false,
    });
    const eventDay = predictForDate(history, {
      targetDate: '2026-10-30',
      mealType: 'Lunch',
      isSpecialEvent: true,
      eventLabel: 'Hackathon Finals',
    });

    expect(eventDay.predictedConsumedKg).toBeGreaterThan(regular.predictedConsumedKg);
    expect(eventDay.recommendedPrepKg).toBeGreaterThan(regular.recommendedPrepKg);
    expect(eventDay.explanation).toContain('Hackathon Finals');
    expect(eventDay.factors.length).toBe(2);
  });

  it('generates a multi-day 7-day horizon cleanly', () => {
    const history = buildSampleHistory(21);
    const horizon = predictHorizon(history, '2026-10-25', 7, 'Lunch');
    expect(horizon).toHaveLength(7);
    expect(horizon[0].date).toBe('2026-10-25');
    expect(horizon[6].date).toBe('2026-10-31');
  });

  it('falls back gracefully when no historical entries exist', () => {
    const forecast = predictForDate([], {
      targetDate: '2026-10-30',
      mealType: 'Dinner',
      isSpecialEvent: true,
    });
    expect(forecast.predictedConsumedKg).toBeGreaterThan(0);
    expect(forecast.recommendedPrepKg).toBeGreaterThan(forecast.predictedConsumedKg);
  });
});
