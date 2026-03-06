import { Router, Request, Response } from 'express';
import prisma from '../prisma';
import { authenticateToken, AuthRequest, requireRole } from '../middleware/auth';
import { publishJson } from '../redis';
import { updateMetric } from '../services/metrics';

const router = Router();
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'internal-secret-123';
const toCameraDto = (camera: any) => ({
    ...camera,
    nodeHealth: camera.healthStatus,
    fps: camera.currentFps ?? 0,
    avgLatency: camera.latencyMs ?? 0,
    uptimePercentage: camera.status === 'OFFLINE' ? 0 : (camera.healthStatus === 'DEGRADED' ? 90 : 99.9)
});

const isInternalRequest = (req: Request): boolean => req.headers['x-api-key'] === INTERNAL_API_KEY;

const authenticateTokenOrInternal = async (req: Request, res: Response, next: any): Promise<any> => {
    if (isInternalRequest(req)) {
        return next();
    }
    return authenticateToken(req as any, res, next);
};

// GET /api/cameras - List all registered cameras
router.get('/', authenticateTokenOrInternal, async (req: Request, res: Response) => {
    try {
        const cameras = await prisma.camera.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.json(cameras.map((camera) => toCameraDto(camera)));
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
router.post('/register', authenticateToken, requireRole(['ADMIN']), async (req: AuthRequest, res: Response): Promise<any> => {
    try {
        const { name, rtsp_url, location_lat, location_lng } = req.body;
        const streamUrl = typeof rtsp_url === 'string' ? rtsp_url.trim() : '';
        const lat = Number(location_lat);
        const lng = Number(location_lng);

        if (!name || !streamUrl || Number.isNaN(lat) || Number.isNaN(lng)) {
            return res.status(400).json({ error: 'Invalid camera payload' });
        }

        const camera = await (prisma as any).camera.create({
            data: {
                name,
                rtspUrl: streamUrl,
                locationLat: lat,
                locationLng: lng,
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

        await updateMetric('active_cameras', 1);

        res.status(201).json(camera);
    } catch (error) {
        res.status(500).json({ error: 'Failed to register camera' });
    }
});

// POST /api/cameras/:id/heartbeat - Unauthenticated endpoint for AI Service to ping
router.post('/:id/heartbeat', async (req: Request, res: Response): Promise<any> => {
    try {
        if (!isInternalRequest(req)) {
            return res.status(401).json({ error: 'Unauthorized camera heartbeat' });
        }

        const { fps, latency_ms, failure_count } = req.body;
        const camId = req.params.id as string;
        const parsedFps = fps !== undefined ? Number(fps) : undefined;
        const parsedLatency = latency_ms !== undefined ? Number(latency_ms) : undefined;
        const parsedFailureCount = failure_count !== undefined ? Number(failure_count) : undefined;

        const cameraBefore = await (prisma as any).camera.findUnique({ where: { id: camId } });
        const technicalStatus = (
            (parsedFps !== undefined && parsedFps < 10) ||
            (parsedLatency !== undefined && parsedLatency > 500)
        ) ? 'DEGRADED' : 'HEALTHY';

        const camera = await (prisma as any).camera.update({
            where: { id: camId },
            data: {
                lastHeartbeat: new Date(),
                status: 'ONLINE',
                healthStatus: technicalStatus,
                currentFps: parsedFps,
                latencyMs: parsedLatency,
                failureCount: parsedFailureCount
            }
        });

        // Metric tracking if coming back online
        if (cameraBefore?.status === 'OFFLINE') {
            await updateMetric('active_cameras', 1);
            await updateMetric('offline_cameras', -1);
        }

        // Broadcast events
        if (technicalStatus === 'HEALTHY' && cameraBefore?.healthStatus !== 'HEALTHY') {
            await publishJson('camera:recovered', { id: camId, name: camera.name });
        } else if (technicalStatus === 'DEGRADED' && cameraBefore?.healthStatus !== 'DEGRADED') {
            await publishJson('camera:degraded', {
                id: camId,
                name: camera.name,
                fps: parsedFps,
                latency: parsedLatency
            });
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
        res.json(toCameraDto(camera));
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch camera' });
    }
});

export default router;
