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
        const online = await (prisma as any).camera.count({ where: { status: 'ONLINE' } });
        const offline = await (prisma as any).camera.count({ where: { status: 'OFFLINE' } });
        const degraded = await (prisma as any).camera.count({ where: { healthStatus: 'DEGRADED' } });

        const avgStats = await (prisma as any).camera.aggregate({
            _avg: {
                currentFps: true,
                latencyMs: true
            }
        });

        res.json({
            online_cameras: online,
            offline_cameras: offline,
            degraded_cameras: degraded,
            avg_fps: avgStats._avg.currentFps || 0,
            avg_latency: avgStats._avg.latencyMs || 0,
            health: online > 0 && offline === 0 && degraded === 0 ? 'OPTIMAL' : (offline > 0 ? 'CRITICAL' : 'WARNING')
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch camera status' });
    }
});

// POST /api/cameras/register - Admin can add new real cameras
router.post('/register', authenticateToken, requireClearance(4), async (req: AuthRequest, res: Response): Promise<any> => {
    try {
        const { name, rtsp_url, location_lat, location_lng } = req.body;

        const camera = await (prisma as any).camera.create({
            data: {
                name,
                rtspUrl: rtsp_url,
                locationLat: parseFloat(location_lat),
                locationLng: parseFloat(location_lng),
                status: 'ONLINE',
                healthStatus: 'HEALTHY',
                lastHeartbeat: new Date(),
                currentFps: 0,
                latencyMs: 0,
                failureCount: 0
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
        const { fps, latency_ms, failure_count } = req.body;
        const camId = req.params.id as string;

        const cameraBefore = await (prisma as any).camera.findUnique({ where: { id: camId } });
        const technicalStatus = (fps && fps < 10) || (latency_ms && latency_ms > 500) ? 'DEGRADED' : 'HEALTHY';

        const camera = await (prisma as any).camera.update({
            where: { id: camId },
            data: {
                lastHeartbeat: new Date(),
                status: 'ONLINE',
                healthStatus: technicalStatus,
                currentFps: fps ? parseFloat(fps) : undefined,
                latencyMs: latency_ms ? parseInt(latency_ms) : undefined,
                failureCount: failure_count !== undefined ? parseInt(failure_count) : undefined
            }
        });

        // Broadcast events
        if (technicalStatus === 'HEALTHY' && cameraBefore?.healthStatus !== 'HEALTHY') {
            await redisPublisher.publish('camera:recovered', JSON.stringify({ id: camId, name: camera.name }));
        } else if (technicalStatus === 'DEGRADED' && cameraBefore?.healthStatus !== 'DEGRADED') {
            await redisPublisher.publish('camera:degraded', JSON.stringify({
                id: camId,
                name: camera.name,
                fps,
                latency: latency_ms
            }));
        }

        res.json({ success: true, health: technicalStatus });
    } catch (error) {
        res.status(404).json({ error: 'Camera not found or update failed' });
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
