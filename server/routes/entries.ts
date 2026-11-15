import type { Response } from 'express';
import { Router } from 'express';
import { prisma } from '../db.ts';
import { requireAuth, type AuthRequest } from '../middleware/auth.ts';
import { sanitizeText } from '../utils/authUtils.ts';

const router = Router();

const ALLOWED_MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
const ALLOWED_CATEGORIES = [
  'Grains & Rice',
  'Proteins & Mains',
  'Produce & Salads',
  'Bakery & Pastry',
  'Dairy & Desserts',
];

// Standard IPCC/FAO food waste emission factor (~2.5 kg CO2e per kg food waste avoided)
const CO2_KG_PER_FOOD_KG = 2.5;

router.use(requireAuth);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { startDate, endDate, mealType, category, scope } = req.query;

    const where: Record<string, unknown> = {};
    // Admin can optionally pass ?scope=all to inspect organization-wide entries
    if (!(user.role === 'ADMIN' && scope === 'all')) {
      where.userId = user.id;
    }

    if (typeof startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      where.date = { ...(where.date as object), gte: startDate };
    }
    if (typeof endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      where.date = { ...(where.date as object), lte: endDate };
    }
    if (typeof mealType === 'string' && mealType !== 'All' && ALLOWED_MEALS.includes(mealType)) {
      where.mealType = mealType;
    }
    if (typeof category === 'string' && category !== 'All' && ALLOWED_CATEGORIES.includes(category)) {
      where.category = category;
    }

    const entries = await prisma.dailyEntry.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: {
        user: {
          select: { name: true, organizationName: true },
        },
      },
    });

    res.json({ entries });
  } catch (err) {
    console.error('List entries error:', err);
    res.status(500).json({ error: 'Failed to load daily entries.' });
  }
});

router.get('/summary', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { startDate, endDate, mealType, scope } = req.query;

    const where: Record<string, unknown> = {};
    if (!(user.role === 'ADMIN' && scope === 'all')) {
      where.userId = user.id;
    }
    if (typeof startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      where.date = { ...(where.date as object), gte: startDate };
    }
    if (typeof endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      where.date = { ...(where.date as object), lte: endDate };
    }
    if (typeof mealType === 'string' && mealType !== 'All' && ALLOWED_MEALS.includes(mealType)) {
      where.mealType = mealType;
    }

    const entries = await prisma.dailyEntry.findMany({
      where,
      orderBy: { date: 'asc' },
    });

    const totalPreparedKg = entries.reduce((acc, e) => acc + e.preparedKg, 0);
    const totalConsumedKg = entries.reduce((acc, e) => acc + e.consumedKg, 0);
    const totalLeftoverKg = entries.reduce((acc, e) => acc + e.leftoverKg, 0);
    const wastePct =
      totalPreparedKg > 0 ? (totalLeftoverKg / totalPreparedKg) * 100 : 0;

    // Compare recent 14 days waste rate against initial baseline (~16% industry baseline)
    // to quantify actual food saved, cost saved, and CO2 avoided.
    const sortedDates = Array.from(new Set(entries.map((e) => e.date))).sort();
    const recentDates = new Set(sortedDates.slice(-14));
    const priorDates = new Set(sortedDates.slice(0, Math.max(0, sortedDates.length - 14)));

    const recentEntries = entries.filter((e) => recentDates.has(e.date));
    const priorEntries = entries.filter((e) => priorDates.has(e.date));

    const recentPrep = recentEntries.reduce((s, e) => s + e.preparedKg, 0);
    const recentWaste = recentEntries.reduce((s, e) => s + e.leftoverKg, 0);
    const recentWasteRate = recentPrep > 0 ? recentWaste / recentPrep : wastePct / 100;

    const priorPrep = priorEntries.reduce((s, e) => s + e.preparedKg, 0);
    const priorWaste = priorEntries.reduce((s, e) => s + e.leftoverKg, 0);
    const baselineWasteRate = priorPrep > 0 ? Math.max(priorWaste / priorPrep, 0.16) : 0.16;

    const avgCostPerKg =
      entries.length > 0
        ? entries.reduce((s, e) => s + e.costPerKg, 0) / entries.length
        : 4.8;

    const savedFoodKg = Math.max(
      0,
      (baselineWasteRate - recentWasteRate) * totalPreparedKg +
        (totalLeftoverKg * 0.25) // factoring redistributed/repurposed savings
    );
    const moneySavedUsd = savedFoodKg * avgCostPerKg;
    const co2AvoidedKg = savedFoodKg * CO2_KG_PER_FOOD_KG;

    // Group by date for trend chart
    const dailyMap = new Map<
      string,
      {
        date: string;
        preparedKg: number;
        consumedKg: number;
        leftoverKg: number;
        headcount: number;
      }
    >();
    for (const e of entries) {
      const existing = dailyMap.get(e.date);
      if (existing) {
        existing.preparedKg += e.preparedKg;
        existing.consumedKg += e.consumedKg;
        existing.leftoverKg += e.leftoverKg;
        existing.headcount = Math.max(existing.headcount, e.headcount);
      } else {
        dailyMap.set(e.date, {
          date: e.date,
          preparedKg: e.preparedKg,
          consumedKg: e.consumedKg,
          leftoverKg: e.leftoverKg,
          headcount: e.headcount,
        });
      }
    }

    const dailyTrend = Array.from(dailyMap.values()).map((d) => ({
      ...d,
      preparedKg: Number(d.preparedKg.toFixed(1)),
      consumedKg: Number(d.consumedKg.toFixed(1)),
      leftoverKg: Number(d.leftoverKg.toFixed(1)),
      wastePct:
        d.preparedKg > 0
          ? Number(((d.leftoverKg / d.preparedKg) * 100).toFixed(1))
          : 0,
    }));

    // Group by category
    const categoryMap = new Map<
      string,
      { category: string; preparedKg: number; consumedKg: number; leftoverKg: number }
    >();
    for (const e of entries) {
      const existing = categoryMap.get(e.category);
      if (existing) {
        existing.preparedKg += e.preparedKg;
        existing.consumedKg += e.consumedKg;
        existing.leftoverKg += e.leftoverKg;
      } else {
        categoryMap.set(e.category, {
          category: e.category,
          preparedKg: e.preparedKg,
          consumedKg: e.consumedKg,
          leftoverKg: e.leftoverKg,
        });
      }
    }

    const byCategory = Array.from(categoryMap.values())
      .map((c) => ({
        ...c,
        preparedKg: Number(c.preparedKg.toFixed(1)),
        consumedKg: Number(c.consumedKg.toFixed(1)),
        leftoverKg: Number(c.leftoverKg.toFixed(1)),
        wastePct:
          c.preparedKg > 0
            ? Number(((c.leftoverKg / c.preparedKg) * 100).toFixed(1))
            : 0,
      }))
      .sort((a, b) => b.leftoverKg - a.leftoverKg);

    // Group by meal type
    const mealMap = new Map<
      string,
      { mealType: string; preparedKg: number; consumedKg: number; leftoverKg: number }
    >();
    for (const e of entries) {
      const existing = mealMap.get(e.mealType);
      if (existing) {
        existing.preparedKg += e.preparedKg;
        existing.consumedKg += e.consumedKg;
        existing.leftoverKg += e.leftoverKg;
      } else {
        mealMap.set(e.mealType, {
          mealType: e.mealType,
          preparedKg: e.preparedKg,
          consumedKg: e.consumedKg,
          leftoverKg: e.leftoverKg,
        });
      }
    }
    const byMealType = Array.from(mealMap.values()).map((m) => ({
      ...m,
      preparedKg: Number(m.preparedKg.toFixed(1)),
      consumedKg: Number(m.consumedKg.toFixed(1)),
      leftoverKg: Number(m.leftoverKg.toFixed(1)),
      wastePct:
        m.preparedKg > 0
          ? Number(((m.leftoverKg / m.preparedKg) * 100).toFixed(1))
          : 0,
    }));

    res.json({
      kpis: {
        totalPreparedKg: Number(totalPreparedKg.toFixed(1)),
        totalConsumedKg: Number(totalConsumedKg.toFixed(1)),
        totalLeftoverKg: Number(totalLeftoverKg.toFixed(1)),
        wastePct: Number(wastePct.toFixed(1)),
        recentWastePct: Number((recentWasteRate * 100).toFixed(1)),
        moneySavedUsd: Number(moneySavedUsd.toFixed(0)),
        co2AvoidedKg: Number(co2AvoidedKg.toFixed(1)),
        entryCount: entries.length,
        daysTracked: sortedDates.length,
      },
      dailyTrend,
      weeklyTrend: dailyTrend.slice(-14),
      byCategory,
      byMealType,
    });
  } catch (err) {
    console.error('Summary error:', err);
    res.status(500).json({ error: 'Failed to compute waste analytics.' });
  }
});

router.get('/export.csv', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { startDate, endDate, mealType } = req.query;

    const where: Record<string, unknown> = { userId: user.id };
    if (typeof startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      where.date = { ...(where.date as object), gte: startDate };
    }
    if (typeof endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      where.date = { ...(where.date as object), lte: endDate };
    }
    if (typeof mealType === 'string' && mealType !== 'All' && ALLOWED_MEALS.includes(mealType)) {
      where.mealType = mealType;
    }

    const entries = await prisma.dailyEntry.findMany({
      where,
      orderBy: [{ date: 'desc' }, { mealType: 'asc' }],
    });

    const header =
      'Date,Meal Type,Category,Prepared (kg),Consumed (kg),Leftover (kg),Waste %,Headcount,Special Event,Event Label,Cost Per Kg ($)\n';
    const rows = entries
      .map((e) => {
        const wPct = e.preparedKg > 0 ? ((e.leftoverKg / e.preparedKg) * 100).toFixed(1) : '0.0';
        const safeEvent = (e.eventLabel || '').replace(/"/g, '""');
        return `${e.date},"${e.mealType}","${e.category}",${e.preparedKg},${e.consumedKg},${e.leftoverKg},${wPct},${e.headcount},${e.isSpecialEvent ? 'Yes' : 'No'},"${safeEvent}",${e.costPerKg}`;
      })
      .join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="ecopredict-waste-analytics.csv"');
    res.send(header + rows);
  } catch (err) {
    console.error('CSV export error:', err);
    res.status(500).json({ error: 'Failed to export CSV.' });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const date = sanitizeText(req.body?.date, 20);
    const mealType = sanitizeText(req.body?.mealType, 30);
    const category = sanitizeText(req.body?.category, 50);
    const preparedKg = Number(req.body?.preparedKg);
    const consumedKg = Number(req.body?.consumedKg);
    const leftoverInput = req.body?.leftoverKg;
    const headcount = Math.round(Number(req.body?.headcount));
    const isSpecialEvent = Boolean(req.body?.isSpecialEvent);
    const eventLabel = sanitizeText(req.body?.eventLabel, 100) || null;
    const notes = sanitizeText(req.body?.notes, 240) || null;
    const costPerKg = Number(req.body?.costPerKg ?? 4.8);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: 'Valid date (YYYY-MM-DD) is required.' });
      return;
    }
    if (!ALLOWED_MEALS.includes(mealType)) {
      res.status(400).json({ error: 'Valid meal type is required.' });
      return;
    }
    if (!ALLOWED_CATEGORIES.includes(category)) {
      res.status(400).json({ error: 'Valid food category is required.' });
      return;
    }
    if (Number.isNaN(preparedKg) || preparedKg <= 0 || preparedKg > 10000) {
      res.status(400).json({ error: 'Prepared quantity must be greater than 0 kg.' });
      return;
    }
    if (Number.isNaN(consumedKg) || consumedKg < 0 || consumedKg > preparedKg) {
      res.status(400).json({ error: 'Consumed quantity must be between 0 and prepared quantity.' });
      return;
    }
    if (Number.isNaN(headcount) || headcount < 1 || headcount > 100000) {
      res.status(400).json({ error: 'Headcount must be at least 1.' });
      return;
    }

    const computedLeftover =
      leftoverInput !== undefined && leftoverInput !== '' && !Number.isNaN(Number(leftoverInput))
        ? Math.max(0, Number(Number(leftoverInput).toFixed(1)))
        : Number(Math.max(0, preparedKg - consumedKg).toFixed(1));

    const entry = await prisma.dailyEntry.create({
      data: {
        date,
        mealType,
        category,
        preparedKg: Number(preparedKg.toFixed(1)),
        consumedKg: Number(consumedKg.toFixed(1)),
        leftoverKg: computedLeftover,
        headcount,
        isSpecialEvent,
        eventLabel: isSpecialEvent ? eventLabel : null,
        notes,
        costPerKg: Number.isNaN(costPerKg) || costPerKg <= 0 ? 4.8 : Number(costPerKg.toFixed(2)),
        userId: user.id,
      },
    });

    res.status(201).json({ entry });
  } catch (err) {
    console.error('Create entry error:', err);
    res.status(500).json({ error: 'Failed to save daily entry.' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const id = String(req.params.id);

    const existing = await prisma.dailyEntry.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Entry not found.' });
      return;
    }
    if (existing.userId !== user.id && user.role !== 'ADMIN') {
      res.status(403).json({ error: 'Not authorized to delete this entry.' });
      return;
    }

    await prisma.dailyEntry.delete({ where: { id } });
    res.json({ message: 'Entry deleted' });
  } catch (err) {
    console.error('Delete entry error:', err);
    res.status(500).json({ error: 'Failed to delete entry.' });
  }
});

export default router;
