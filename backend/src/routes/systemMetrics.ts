import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { getAllMetrics } from '../services/metrics';

const router = Router();

// GET /api/system/metrics - Get all real-time system metrics
router.get('/metrics', authenticateToken, async (req: Request, res: Response) => {
    try {
        const metrics = await getAllMetrics();
        res.json(metrics);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch system metrics' });
    }
});

export default router;
