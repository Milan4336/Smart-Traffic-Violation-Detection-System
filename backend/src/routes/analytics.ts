import { Router, Response } from 'express';
import prisma from '../prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/analytics
router.get('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<any> => {
    try {
        const totalViolations = await prisma.violation.count();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayViolations = await prisma.violation.count({
            where: {
                createdAt: {
                    gte: today
                }
            }
        });

        // Compute AI confidence average over the last 100 violations
        const recentViolations = await prisma.violation.findMany({
            take: 100,
            orderBy: { createdAt: 'desc' },
            select: { confidenceScore: true }
        });

        let aiConfidenceAverage = 0;
        if (recentViolations.length > 0) {
            const sum = recentViolations.reduce((acc, curr) => acc + curr.confidenceScore, 0);
            aiConfidenceAverage = sum / recentViolations.length;
        }

        const activeCameras = await prisma.camera.count({
            where: { status: 'ONLINE' }
        });

        res.json({
            metrics: {
                totalViolations,
                todayViolations,
                activeCameras,
                aiConfidenceAverage
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

export default router;
