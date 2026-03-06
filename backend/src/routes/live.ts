import { Router, Request, Response } from 'express';
import axios from 'axios';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://ai-service:8000';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'internal-secret-123';

const aiHeaders = {
    'x-api-key': INTERNAL_API_KEY
};

/**
 * POST /api/live/:cameraId/start
 * Tells AI service to start generating HLS for this camera.
 */
router.post('/:cameraId/start', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    try {
        const { cameraId } = req.params;
        const response = await axios.post(`${AI_SERVICE_URL}/cameras/${cameraId}/live/start`, {}, {
            headers: aiHeaders
        });
        const data = (response.data && typeof response.data === 'object') ? (response.data as Record<string, unknown>) : {};

        res.json({
            ...data,
            streamUrl: `/uploads/live/${cameraId}/index.m3u8`
        });
    } catch (error: any) {
        console.error(`Failed to start live stream for ${req.params.cameraId}:`, error.message);
        res.status(500).json({ error: 'Failed to start AI live stream' });
    }
});

/**
 * POST /api/live/:cameraId/stop
 * Tells AI service to stop generating HLS.
 */
router.post('/:cameraId/stop', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    try {
        const { cameraId } = req.params;
        const response = await axios.post(`${AI_SERVICE_URL}/cameras/${cameraId}/live/stop`, {}, {
            headers: aiHeaders
        });
        res.json(response.data);
    } catch (error: any) {
        console.error(`Failed to stop live stream:`, error.message);
        res.status(500).json({ error: 'Failed to stop AI live stream' });
    }
});

/**
 * POST /api/live/:cameraId/snapshot
 * Tells AI service to capture a snapshot for this camera.
 */
router.post('/:cameraId/snapshot', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    try {
        const { cameraId } = req.params;
        const response = await axios.post(`${AI_SERVICE_URL}/cameras/${cameraId}/snapshot`, {}, {
            headers: aiHeaders
        });
        res.json(response.data);
    } catch (error: any) {
        console.error(`Failed to capture snapshot for ${req.params.cameraId}:`, error.message);
        res.status(500).json({ error: 'Failed to capture AI snapshot' });
    }
});

export default router;
