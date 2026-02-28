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
import updatesRouter from './routes/updates';
import videosRouter from './routes/videos';
import vehiclesRouter from './routes/vehicles';

dotenv.config();

const app = express();
const server = http.createServer(app);

// Security Middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors());
app.use(express.json());

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again after 15 minutes'
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
app.use('/api/updates', updatesRouter);
app.use('/api/videos', videosRouter);
app.use('/api/vehicles', vehiclesRouter);

// Initialize Socket.IO & Redis
initSocket(server);
initRedisSubscriber().catch(console.error);

const PORT = process.env.PORT || 5000;

import prisma from './prisma';

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
                await prisma.camera.update({
                    where: { id: cam.id },
                    data: { status: 'OFFLINE', nodeHealth: 'OFFLINE' }
                });
                console.log(`[ALERT] Camera ${cam.name} went OFFLINE.`);

                // Alert Frontend via Redis/WebSocket
                await initRedisSubscriber.prototype?.getIO?.()?.emit('camera:offline', { id: cam.id });
                // We'll rely on the pure websocket integration if we can't access it easily here.
                // Re-importing redisPublisher
                const { redisPublisher } = require('./redis');
                if (redisPublisher) {
                    await redisPublisher.publish('camera:offline', JSON.stringify({ id: cam.id, name: cam.name }));
                }
            }
        }
    } catch (err) {
        console.error('Error running camera heartbeat check:', err);
    }
}, 10000); // Check every 10 seconds

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
