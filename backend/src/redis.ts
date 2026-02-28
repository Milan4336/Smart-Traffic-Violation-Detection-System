import { createClient } from 'redis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
export const redisPublisher = createClient({ url: redisUrl });

redisPublisher.on('error', (err) => console.error('Redis Publisher Error', err));

// Connect automatically
(async () => {
    await redisPublisher.connect();
})();
