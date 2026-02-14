import { Router } from 'express';
import { authenticateJWT } from '../middlewares/auth.middleware';
import prisma from '../lib/prisma';

const router = Router();

router.get('/me', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
        res.sendStatus(401);
        return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    if (!user) {
        res.sendStatus(404);
        return;
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
