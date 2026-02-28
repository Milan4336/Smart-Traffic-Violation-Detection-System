import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import { createClient } from 'redis';

let io: Server;

export const initSocket = (server: HttpServer) => {
    io = new Server(server, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST', 'PATCH']
        }
    });

    io.on('connection', (socket) => {
        console.log(`Client connected: ${socket.id}`);

        socket.on('disconnect', () => {
            console.log(`Client disconnected: ${socket.id}`);
        });
    });

    return io;
};

export const getIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized!');
    }
    return io;
};

// Redis subscriber setup
export const initRedisSubscriber = async () => {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const subscriber = createClient({ url: redisUrl });

    subscriber.on('error', (err) => console.error('Redis Client Error', err));

    await subscriber.connect();
    console.log('Redis connected for Pub/Sub');

    const topics = [
        'violation:new',
        'violation:verified',
        'camera:offline',
        'camera:degraded',
        'camera:recovered',
        'alert:new',
        'alert:status_change',
        'fine:generated'
    ];

    for (const topic of topics) {
        await subscriber.subscribe(topic, (message) => {
            console.log(`Broadcasting [${topic}]`);
            try {
                const payload = typeof message === 'string' ? JSON.parse(message) : message;
                getIO().emit(topic, payload);
            } catch (e) {
                // If it's already an object or raw string that's not JSON
                getIO().emit(topic, message);
            }
        });
    }
};
