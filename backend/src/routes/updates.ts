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

        // Seed some mock updates if empty
        if (updates.length === 0) {
            const mockUpdate = {
                versionNumber: 'v1.2.0',
                releaseName: 'Sentinel Upgrade',
                releaseType: 'major',
                releaseStatus: 'released',
                createdBy: 'SYSTEM AUTOMATION',
            };
            await prisma.systemVersion.create({ data: mockUpdate });
            return res.json(await prisma.systemVersion.findMany({ orderBy: { createdAt: 'desc' }, include: { patchNotes: true } }));
        }

        res.json(updates);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch updates' });
    }
});

export default router;
