// Cosmetics only. Coins buy birds; nothing here affects hydration or health.

import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { prisma } from '../prisma.js';

export const storeRouter = Router();
storeRouter.use(requireAuth);

storeRouter.get('/', async (req, res) => {
  const [user, birds, owned] = await Promise.all([
    prisma.user.findUnique({ where: { id: req.userId! } }),
    prisma.bird.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.ownedBird.findMany({ where: { userId: req.userId! }, select: { birdId: true } }),
  ]);

  if (!user) {
    res.status(401).json({ error: 'Not signed in' });
    return;
  }

  const ownedIds = new Set(owned.map((row) => row.birdId));
  res.json({
    coinBalance: user.coinBalance,
    activeBirdId: user.activeBirdId,
    birds: birds.map((bird) => ({
      ...bird,
      owned: bird.isDefault || ownedIds.has(bird.id),
      active: bird.id === user.activeBirdId,
      affordable: user.coinBalance >= bird.priceCoins,
    })),
  });
});

storeRouter.post('/purchase', async (req, res) => {
  const { birdId } = req.body ?? {};
  const [user, bird] = await Promise.all([
    prisma.user.findUnique({ where: { id: req.userId! } }),
    typeof birdId === 'string' ? prisma.bird.findUnique({ where: { id: birdId } }) : null,
  ]);

  if (!user) {
    res.status(401).json({ error: 'Not signed in' });
    return;
  }
  if (!bird) {
    res.status(404).json({ error: 'Bird not found' });
    return;
  }

  const alreadyOwned =
    bird.isDefault ||
    (await prisma.ownedBird.findUnique({
      where: { userId_birdId: { userId: user.id, birdId: bird.id } },
    })) !== null;

  if (alreadyOwned) {
    res.status(409).json({ error: 'You already own this one' });
    return;
  }
  if (user.coinBalance < bird.priceCoins) {
    res.status(402).json({ error: 'Not enough coins yet' });
    return;
  }

  await prisma.$transaction([
    prisma.ownedBird.create({ data: { userId: user.id, birdId: bird.id } }),
    prisma.user.update({
      where: { id: user.id },
      data: { coinBalance: { decrement: bird.priceCoins } },
    }),
  ]);

  res.status(201).json({ ok: true });
});

storeRouter.post('/select', async (req, res) => {
  const { birdId } = req.body ?? {};
  if (typeof birdId !== 'string') {
    res.status(400).json({ error: 'Choose a bird' });
    return;
  }

  const bird = await prisma.bird.findUnique({ where: { id: birdId } });
  if (!bird) {
    res.status(404).json({ error: 'Bird not found' });
    return;
  }

  const owned =
    bird.isDefault ||
    (await prisma.ownedBird.findUnique({
      where: { userId_birdId: { userId: req.userId!, birdId } },
    })) !== null;

  if (!owned) {
    res.status(403).json({ error: 'Buy this bird first' });
    return;
  }

  await prisma.user.update({ where: { id: req.userId! }, data: { activeBirdId: birdId } });
  res.json({ ok: true, activeBirdId: birdId });
});
