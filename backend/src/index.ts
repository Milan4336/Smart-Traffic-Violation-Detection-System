import express from 'express';
import cors from 'cors';
import http from 'http';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';

import { initSocket, initRedisSubscriber } from './socket';

import authRouter from './routes/auth';
import violationsRouter from './routes/violations';
import camerasRouter from './routes/cameras';
import analyticsRouter from './routes/analytics';
import systemRouter from './routes/system';
import systemMetricsRouter from './routes/systemMetrics';
import updatesRouter from './routes/updates';
import videosRouter from './routes/videos';
import vehiclesRouter from './routes/vehicles';
import alertsRouter from './routes/alerts';
import liveRouter from './routes/live';
import usersRouter from './routes/users';
import reportsRouter from './routes/reports';
import auditLogsRouter from './routes/auditLogs';
import './cron/metricsReset';

dotenv.config();

const app = express();
const server = http.createServer(app);
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'internal-secret-123';

// Security Middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'backend', timestamp: new Date().toISOString() });
});

// Rate Limiting
const apiRateLimitMax = Number(process.env.API_RATE_LIMIT_MAX || 1000);
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: Number.isNaN(apiRateLimitMax) ? 1000 : apiRateLimitMax,
    message: 'Too many requests from this IP, please try again after 15 minutes',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.headers['x-api-key'] === INTERNAL_API_KEY
});
app.use('/api', limiter);

// Static file serving for evidence (uploads dir)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/violations', violationsRouter);
app.use('/api/cameras', camerasRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/system', systemRouter);
app.use('/api/system', systemMetricsRouter);
app.use('/api/updates', updatesRouter);
app.use('/api/videos', videosRouter);
app.use('/api/vehicles', vehiclesRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/live', liveRouter);
app.use('/api/users', usersRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/audit-logs', auditLogsRouter);

// Initialize Socket.IO & Redis
initSocket(server);
initRedisSubscriber().catch(console.error);

const PORT = process.env.PORT || 5000;

import prisma from './prisma';
import { synchronizeCoreMetrics, updateMetric } from './services/metrics';
import { publishJson } from './redis';
import { ensureBootstrapData } from './bootstrap';

// Initiate Camera Heartbeat Cron
setInterval(async () => {
    try {
        const threshold = new Date(Date.now() - 30 * 1000); // 30 seconds ago
        const stalledCameras = await prisma.camera.findMany({
            where: {
                status: 'ONLINE',
                lastHeartbeat: { lt: threshold }
            }
        });

        if (stalledCameras.length > 0) {
            for (const cam of stalledCameras) {
                await (prisma as any).camera.update({
                    where: { id: cam.id },
                    data: { status: 'OFFLINE', healthStatus: 'OFFLINE' }
                });
                console.log(`[ALERT] Camera ${cam.name} went OFFLINE.`);

                // Alert Frontend via Redis/WebSocket
                await publishJson('camera:offline', { id: cam.id, name: cam.name });

                // Update Real-Time Metrics
                await updateMetric('offline_cameras', 1);
                await updateMetric('active_cameras', -1);
            }
        }
    } catch (err) {
        console.error('Error running camera heartbeat check:', err);
    }
}, 10000); // Check every 10 seconds

// Reconcile dashboard counters from DB so metrics remain accurate across restarts.
setInterval(() => {
    synchronizeCoreMetrics().catch((error) => {
        console.error('Failed to synchronize metrics:', error);
    });
}, 60 * 1000);

const startServer = async () => {
    try {
        await ensureBootstrapData();
        await synchronizeCoreMetrics();
    } catch (error) {
        console.error('Startup bootstrap failed:', error);
    }

    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
};

startServer();
