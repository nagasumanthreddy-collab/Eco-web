import type { Response } from 'express';
import { Router } from 'express';
import { addDaysISO, predictHorizon } from '../../ml/forecaster.ts';
import { prisma } from '../db.ts';
import { requireAuth, type AuthRequest } from '../middleware/auth.ts';

const router = Router();

router.use(requireAuth);

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

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const threshold = user.wasteAlertThreshold;

    const entries = await prisma.dailyEntry.findMany({
      where: { userId: user.id },
      orderBy: { date: 'asc' },
    });

    const alerts: WasteAlertItem[] = [];
    const todayIso = new Date().toISOString().slice(0, 10);
    const tomorrowIso = addDaysISO(todayIso, 1);

    // 1. Forecast-driven waste alerts over next 7 days per meal type
    const mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
    for (const meal of mealTypes) {
      const forecast = predictHorizon(entries, tomorrowIso, 7, meal, {}, threshold);
      for (const day of forecast) {
        if (day.expectedWasteWithCurrentHabitPct >= threshold) {
          const excessKg = Number(
            Math.max(0, day.baselinePrepKg - day.predictedConsumedKg).toFixed(1)
          );
          const isCritical = day.expectedWasteWithCurrentHabitPct >= threshold + 4;
          alerts.push({
            id: `pred-${day.date}-${meal}`,
            severity: isCritical ? 'CRITICAL' : 'WARNING',
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

    // 2. Recent 10-day historical spikes exceeding threshold
    const recentCutoff = addDaysISO(todayIso, -10);
    const recentEntries = entries.filter((e) => e.date >= recentCutoff);
    for (const entry of recentEntries) {
      const wastePct =
        entry.preparedKg > 0
          ? Number(((entry.leftoverKg / entry.preparedKg) * 100).toFixed(1))
          : 0;
      if (wastePct >= threshold + 2) {
        alerts.push({
          id: `hist-${entry.id}`,
          severity: wastePct >= threshold + 6 ? 'CRITICAL' : 'WARNING',
          source: 'HISTORICAL',
          date: entry.date,
          mealType: entry.mealType,
          wastePct,
          thresholdPct: threshold,
          estimatedExcessKg: entry.leftoverKg,
          title: `Recorded ${wastePct}% waste in ${entry.mealType} (${entry.category})`,
          recommendation: `${entry.leftoverKg} kg leftover logged. Consider listing recurring surplus with nearby NGOs.`,
        });
      }
    }

    alerts.sort((a, b) => {
      if (a.source !== b.source) return a.source === 'PREDICTION' ? -1 : 1;
      return b.wastePct - a.wastePct;
    });

    res.json({
      thresholdPct: threshold,
      alerts,
    });
  } catch (err) {
    console.error('Alerts fetch error:', err);
    res.status(500).json({ error: 'Failed to evaluate waste alerts.' });
  }
});

router.put('/threshold', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const threshold = Number(req.body?.thresholdPct);
    if (Number.isNaN(threshold) || threshold < 2 || threshold > 50) {
      res.status(400).json({ error: 'Threshold must be between 2% and 50%.' });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { wasteAlertThreshold: Number(threshold.toFixed(1)) },
      select: { wasteAlertThreshold: true },
    });

    res.json({ thresholdPct: updated.wasteAlertThreshold });
  } catch (err) {
    console.error('Update threshold error:', err);
    res.status(500).json({ error: 'Failed to update alert threshold.' });
  }
});

export default router;
