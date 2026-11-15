import type { Response } from 'express';
import { Router } from 'express';
import { prisma } from '../db.ts';
import { requireAdmin, requireAuth, type AuthRequest } from '../middleware/auth.ts';

const router = Router();

router.use(requireAuth, requireAdmin);

router.get('/organizations', async (_req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        organizationName: true,
        organizationType: true,
        wasteAlertThreshold: true,
        createdAt: true,
        entries: {
          select: {
            preparedKg: true,
            consumedKg: true,
            leftoverKg: true,
          },
        },
        _count: {
          select: {
            surplusItems: true,
            pickupRequests: true,
          },
        },
      },
    });

    const organizations = users.map((u) => {
      const prepared = u.entries.reduce((s, e) => s + e.preparedKg, 0);
      const leftover = u.entries.reduce((s, e) => s + e.leftoverKg, 0);
      const wastePct = prepared > 0 ? Number(((leftover / prepared) * 100).toFixed(1)) : 0;
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        organizationName: u.organizationName,
        organizationType: u.organizationType,
        wasteAlertThreshold: u.wasteAlertThreshold,
        totalEntries: u.entries.length,
        totalPreparedKg: Number(prepared.toFixed(1)),
        totalLeftoverKg: Number(leftover.toFixed(1)),
        wastePct,
        surplusCount: u._count.surplusItems,
        pickupCount: u._count.pickupRequests,
        createdAt: u.createdAt,
      };
    });

    res.json({ organizations });
  } catch (err) {
    console.error('Admin organizations error:', err);
    res.status(500).json({ error: 'Failed to load organization metrics.' });
  }
});

export default router;
