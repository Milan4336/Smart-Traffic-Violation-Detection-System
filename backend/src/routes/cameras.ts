import { Router, Request, Response } from 'express';
import prisma from '../prisma';
import { authenticateToken, AuthRequest, requireClearance } from '../middleware/auth';
import { redisPublisher } from '../redis';

const router = Router();

// GET /api/cameras - List all registered cameras
router.get('/', authenticateToken, async (req: Request, res: Response) => {
    try {
        const cameras = await prisma.camera.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.json(cameras);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch cameras' });
    }
});

// GET /api/cameras/status - Return statistics for system metrics panel
router.get('/status', authenticateToken, async (req: Request, res: Response) => {
    try {
        const online = await prisma.camera.count({ where: { status: 'ONLINE' } });
        const offline = await prisma.camera.count({ where: { status: 'OFFLINE' } });
        const latencyCameras = await prisma.camera.count({ where: { nodeHealth: 'DELAYED' } });

        res.json({
            online_cameras: online,
            offline_cameras: offline,
            latency_issues: latencyCameras,
            health: online > 0 && offline === 0 ? 'OPTIMAL' : (offline > 0 ? 'CRITICAL' : 'WARNING')
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch camera status' });
    }
});

// POST /api/cameras/register - Admin can add new real cameras
router.post('/register', authenticateToken, requireClearance(4), async (req: AuthRequest, res: Response): Promise<any> => {
    try {
        const { name, rtsp_url, location_lat, location_lng } = req.body;

        const camera = await prisma.camera.create({
            data: {
                name,
                rtspUrl: rtsp_url,
                locationLat: location_lat,
                locationLng: location_lng,
                status: 'ONLINE',
                nodeHealth: 'HEALTHY',
                lastHeartbeat: new Date()
            }
        });

        // Audit Logging
        await prisma.systemChangelog.create({
            data: {
                changeType: 'ADD_CAMERA',
                affectedModule: 'CameraSystem',
                newValue: JSON.stringify({ id: camera.id, name: camera.name }),
                changedBy: req.user!.id
            }
        });

        res.status(201).json(camera);
    } catch (error) {
        res.status(500).json({ error: 'Failed to register camera' });
    }
});

// POST /api/cameras/:id/heartbeat - Unauthenticated endpoint for AI Service to ping
router.post('/:id/heartbeat', async (req: Request, res: Response): Promise<any> => {
    try {
        const camera = await prisma.camera.update({
            where: { id: req.params.id as string },
            data: {
                lastHeartbeat: new Date(),
                status: 'ONLINE',
                nodeHealth: 'HEALTHY'
            }
        });
        res.json({ success: true, camera });
    } catch (error) {
        // Silently fail if camera ID doesn't exist
        res.status(404).json({ error: 'Camera not found' });
    }
});

// GET /api/cameras/:id
router.get('/:id', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    try {
        const camera = await prisma.camera.findUnique({ where: { id: req.params.id as string } });
        if (!camera) return res.status(404).json({ error: 'Camera not found' });
        res.json(camera);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch camera' });
    }
});

export default router;
