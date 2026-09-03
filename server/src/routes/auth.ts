import { Router } from 'express';
import { createToken, isUserKey, requireAuth, USER_KEYS, verifyPassword } from '../auth.js';
import { prisma } from '../prisma.js';
import { buildSummary, loadUser } from '../services/hydration.js';

export const authRouter = Router();

/** The two selectable people. No password or secret is ever included here. */
authRouter.get('/users', async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { key: { in: [...USER_KEYS] } },
    select: { key: true, name: true },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ users });
});

authRouter.post('/login', async (req, res) => {
  const { userKey, password } = req.body ?? {};

  if (!isUserKey(userKey)) {
    res.status(400).json({ error: 'Choose Principe or Principessa' });
    return;
  }
  if (!verifyPassword(password)) {
    // Same message either way, so the response never reveals which part failed.
    res.status(401).json({ error: 'Wrong password' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { key: userKey } });
  if (!user) {
    res.status(500).json({ error: 'That account has not been seeded yet' });
    return;
  }

  res.json({
    token: createToken(user.id),
    user: { id: user.id, key: user.key, name: user.name },
  });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await loadUser(req.userId!);
  if (!user) {
    res.status(401).json({ error: 'Not signed in' });
    return;
  }
  res.json({ me: await buildSummary(user) });
});

// Logout is purely client-side (the device forgets its token); this endpoint
// exists so the frontend has one obvious place to call.
authRouter.post('/logout', (_req, res) => {
  res.json({ ok: true });
});
