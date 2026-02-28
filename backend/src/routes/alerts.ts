import { Router, Request, Response } from 'express';
import prisma from '../prisma';
import { authenticateToken, AuthRequest, requireClearance } from '../middleware/auth';
import { redisPublisher } from '../redis';

const router = Router();

// GET /api/alerts - Get all active/recent alerts
router.get('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<any> => {
    try {
        const alerts = await (prisma as any).alert.findMany({
            where: {
                status: {
                    in: ['ACTIVE', 'ACKNOWLEDGED']
                }
            },
            orderBy: { createdAt: 'desc' },
            include: {
                violation: true
            }
        });
        res.json(alerts);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch alerts' });
    }
});

// PATCH /api/alerts/:id/status - Acknowledge or Resolve an alert
router.patch('/:id/status', authenticateToken, requireClearance(2), async (req: AuthRequest, res: Response): Promise<any> => {
    try {
        const { id } = req.params;
        const { status } = req.body; // 'ACKNOWLEDGED' or 'RESOLVED'

        const updateData: any = { status };
        if (status === 'ACKNOWLEDGED') {
            updateData.acknowledgedAt = new Date();
        } else if (status === 'RESOLVED') {
            updateData.resolvedAt = new Date();
        }

        const alert = await (prisma as any).alert.update({
            where: { id: id as string },
            data: updateData,
            include: { violation: true }
        });

        // Broadcast update via Redis
        if (redisPublisher) {
            await redisPublisher.publish('alert:status_change', JSON.stringify({
                id: alert.id,
                status: alert.status,
                plateNumber: alert.plateNumber
            }));
        }

        res.json(alert);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update alert status' });
    }
});

export default router;
