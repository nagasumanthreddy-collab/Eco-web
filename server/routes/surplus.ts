import type { Response } from 'express';
import { Router } from 'express';
import { prisma } from '../db.ts';
import { requireAuth, type AuthRequest } from '../middleware/auth.ts';
import { sanitizeText } from '../utils/authUtils.ts';

const router = Router();

router.use(requireAuth);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const listings = await prisma.surplusListing.findMany({
      where: user.role === 'ADMIN' ? {} : { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { name: true, organizationName: true },
        },
        pickupRequests: {
          include: {
            ngo: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    const ngos = await prisma.ngoPartner.findMany({
      orderBy: { distanceKm: 'asc' },
    });

    res.json({ listings, ngos });
  } catch (err) {
    console.error('Surplus list error:', err);
    res.status(500).json({ error: 'Failed to load surplus redistribution data.' });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const title = sanitizeText(req.body?.title, 120);
    const category = sanitizeText(req.body?.category, 60);
    const quantityKg = Number(req.body?.quantityKg);
    const mealType = sanitizeText(req.body?.mealType, 30);
    const expiryWindow = sanitizeText(req.body?.expiryWindow, 60);
    const storageType = sanitizeText(req.body?.storageType, 40) || 'Refrigerated';

    if (!title || title.length < 3) {
      res.status(400).json({ error: 'Please provide a descriptive surplus item title.' });
      return;
    }
    if (Number.isNaN(quantityKg) || quantityKg <= 0 || quantityKg > 5000) {
      res.status(400).json({ error: 'Quantity must be greater than 0 kg.' });
      return;
    }
    if (!expiryWindow) {
      res.status(400).json({ error: 'Pickup expiry window is required.' });
      return;
    }

    const listing = await prisma.surplusListing.create({
      data: {
        title,
        category: category || 'Grains & Rice',
        quantityKg: Number(quantityKg.toFixed(1)),
        mealType: mealType || 'Lunch',
        expiryWindow,
        storageType,
        status: 'AVAILABLE',
        userId: user.id,
      },
      include: {
        user: { select: { name: true, organizationName: true } },
        pickupRequests: { include: { ngo: true } },
      },
    });

    res.status(201).json({ listing });
  } catch (err) {
    console.error('Create surplus error:', err);
    res.status(500).json({ error: 'Failed to list surplus food.' });
  }
});

router.post('/:id/request-pickup', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const surplusId = String(req.params.id);
    const ngoId = sanitizeText(req.body?.ngoId, 60);
    const pickupTime = sanitizeText(req.body?.pickupTime, 60) || 'Within 2 hours';
    const notes = sanitizeText(req.body?.notes, 200) || null;

    if (!ngoId) {
      res.status(400).json({ error: 'Please select an NGO or food bank partner.' });
      return;
    }

    const surplus = await prisma.surplusListing.findUnique({ where: { id: surplusId } });
    if (!surplus) {
      res.status(404).json({ error: 'Surplus item not found.' });
      return;
    }
    if (surplus.userId !== user.id && user.role !== 'ADMIN') {
      res.status(403).json({ error: 'Not authorized to schedule pickup for this listing.' });
      return;
    }
    if (surplus.status !== 'AVAILABLE') {
      res.status(400).json({ error: 'Pickup has already been requested or collected for this item.' });
      return;
    }

    const ngo = await prisma.ngoPartner.findUnique({ where: { id: ngoId } });
    if (!ngo) {
      res.status(404).json({ error: 'Selected NGO partner was not found.' });
      return;
    }

    const [pickupRequest, updatedListing] = await prisma.$transaction([
      prisma.pickupRequest.create({
        data: {
          surplusId,
          ngoId,
          userId: user.id,
          pickupTime,
          notes,
          status: 'SCHEDULED',
        },
        include: { ngo: true },
      }),
      prisma.surplusListing.update({
        where: { id: surplusId },
        data: { status: 'REQUESTED' },
        include: {
          user: { select: { name: true, organizationName: true } },
          pickupRequests: { include: { ngo: true }, orderBy: { createdAt: 'desc' } },
        },
      }),
    ]);

    res.status(201).json({ pickupRequest, listing: updatedListing });
  } catch (err) {
    console.error('Request pickup error:', err);
    res.status(500).json({ error: 'Unable to schedule NGO pickup.' });
  }
});

router.patch('/:id/collect', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const surplusId = String(req.params.id);

    const surplus = await prisma.surplusListing.findUnique({ where: { id: surplusId } });
    if (!surplus) {
      res.status(404).json({ error: 'Surplus item not found.' });
      return;
    }
    if (surplus.userId !== user.id && user.role !== 'ADMIN') {
      res.status(403).json({ error: 'Not authorized.' });
      return;
    }

    await prisma.pickupRequest.updateMany({
      where: { surplusId },
      data: { status: 'COMPLETED' },
    });

    const updatedListing = await prisma.surplusListing.update({
      where: { id: surplusId },
      data: { status: 'COLLECTED' },
      include: {
        user: { select: { name: true, organizationName: true } },
        pickupRequests: { include: { ngo: true }, orderBy: { createdAt: 'desc' } },
      },
    });

    res.json({ listing: updatedListing });
  } catch (err) {
    console.error('Mark collected error:', err);
    res.status(500).json({ error: 'Failed to update collection status.' });
  }
});

export default router;
