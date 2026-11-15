import type { Response } from 'express';
import { Router } from 'express';
import { addDaysISO, predictForDate, predictHorizon } from '../../ml/forecaster.ts';
import { prisma } from '../db.ts';
import { requireAuth, type AuthRequest } from '../middleware/auth.ts';
import { sanitizeText } from '../utils/authUtils.ts';

const router = Router();

router.use(requireAuth);

router.get('/forecast', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const mealType = sanitizeText(req.query?.mealType || 'All', 30) || 'All';
    const days = Math.min(14, Math.max(1, Number(req.query?.days) || 7));
    const isSpecialEventTomorrow = req.query?.specialEvent === 'true';
    const eventLabel = sanitizeText(req.query?.eventLabel || '', 80);

    const entries = await prisma.dailyEntry.findMany({
      where: { userId: user.id },
      orderBy: { date: 'asc' },
      select: {
        date: true,
        mealType: true,
        preparedKg: true,
        consumedKg: true,
        leftoverKg: true,
        headcount: true,
        isSpecialEvent: true,
        eventLabel: true,
      },
    });

    const todayIso = new Date().toISOString().slice(0, 10);
    const tomorrowIso = addDaysISO(todayIso, 1);

    const eventDates: Record<string, string> = {};
    if (isSpecialEventTomorrow) {
      eventDates[tomorrowIso] = eventLabel || 'Scheduled Special Event';
    }

    const horizon = predictHorizon(
      entries,
      tomorrowIso,
      days,
      mealType,
      eventDates,
      user.wasteAlertThreshold
    );

    const tomorrow = predictForDate(entries, {
      targetDate: tomorrowIso,
      mealType,
      isSpecialEvent: isSpecialEventTomorrow,
      eventLabel,
      wasteAlertThresholdPct: user.wasteAlertThreshold,
    });

    // Also compute per-meal breakdown for tomorrow
    const mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
    const tomorrowByMeal = mealTypes.map((m) =>
      predictForDate(entries, {
        targetDate: tomorrowIso,
        mealType: m,
        isSpecialEvent: isSpecialEventTomorrow,
        eventLabel,
        wasteAlertThresholdPct: user.wasteAlertThreshold,
      })
    );

    res.json({
      tomorrow,
      horizon,
      tomorrowByMeal,
      thresholdPct: user.wasteAlertThreshold,
      historySamples: entries.length,
    });
  } catch (err) {
    console.error('Prediction error:', err);
    res.status(500).json({ error: 'Failed to generate demand prediction.' });
  }
});

export default router;
