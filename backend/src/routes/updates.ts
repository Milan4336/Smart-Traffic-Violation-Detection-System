import { Router } from 'express';
import prisma from '../prisma';

const router = Router();

// GET /api/updates
router.get('/', async (req, res) => {
    try {
        const updates = await prisma.systemUpdate.findMany({
            orderBy: { createdAt: 'desc' },
            take: 10
        });

        // Seed some mock updates if empty
        if (updates.length === 0) {
            const mockUpdates = [
                { version: '2.4.1', title: 'System Patch Applied', description: 'Auto-deployed fix for Cam-09 latency.' },
                { version: '2.4.0', title: 'Model Upgrade', description: 'Upgraded AI detection model to YOLOv8-nano.' }
            ];
            await prisma.systemUpdate.createMany({ data: mockUpdates });
            return res.json(await prisma.systemUpdate.findMany({ orderBy: { createdAt: 'desc' } }));
        }

        res.json(updates);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch updates' });
    }
});

export default router;
