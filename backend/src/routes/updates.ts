import { Router } from 'express';
import prisma from '../prisma';

const router = Router();

// GET /api/updates
router.get('/', async (req, res) => {
    try {
        const updates = await prisma.systemVersion.findMany({
            orderBy: { createdAt: 'desc' },
            take: 10,
            include: { patchNotes: true }
        });
        res.json(updates);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch updates' });
    }
});

export default router;
