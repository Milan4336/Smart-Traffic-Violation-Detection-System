"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initRedisSubscriber = exports.getIO = exports.initSocket = void 0;
const socket_io_1 = require("socket.io");
const http_1 = require("http");
const redis_1 = require("redis");
let io;
const initSocket = (server) => {
    io = new socket_io_1.Server(server, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
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
exports.initSocket = initSocket;
const getIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized!');
    }
    return io;
};
exports.getIO = getIO;
// Redis subscriber setup
const initRedisSubscriber = async () => {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const subscriber = (0, redis_1.createClient)({ url: redisUrl });
    subscriber.on('error', (err) => console.error('Redis Client Error', err));
    await subscriber.connect();
    console.log('Redis connected for Pub/Sub');
    await subscriber.subscribe('new_violation', (message) => {
        const data = JSON.parse(message);
        console.log('Broadcasting new violation:', data);
        (0, exports.getIO)().emit('new_violation', data);
    });
};
exports.initRedisSubscriber = initRedisSubscriber;
//# sourceMappingURL=socket.js.map