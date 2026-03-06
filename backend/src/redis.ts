import { createClient } from 'redis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
export const redisPublisher = createClient({ url: redisUrl });

let connectPromise: Promise<void> | null = null;

redisPublisher.on('error', (err) => {
    console.error('Redis Publisher Error', err);
});

export const ensureRedisPublisher = async (): Promise<void> => {
    if (redisPublisher.isOpen) {
        return;
    }

    if (!connectPromise) {
        connectPromise = redisPublisher
            .connect()
            .then(() => undefined)
            .catch((error) => {
                connectPromise = null;
                throw error;
            });
    }

    await connectPromise;
};

export const publishJson = async (topic: string, payload: unknown): Promise<void> => {
    try {
        await ensureRedisPublisher();
        const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
        await redisPublisher.publish(topic, message);
    } catch (error) {
        console.error(`[Redis] Failed to publish topic "${topic}"`, error);
    }
};

export const pushJsonToQueue = async (queueName: string, payload: unknown): Promise<void> => {
    try {
        await ensureRedisPublisher();
        const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
        await redisPublisher.lPush(queueName, message);
    } catch (error) {
        console.error(`[Redis] Failed to push into queue "${queueName}"`, error);
    }
};

// Connect on startup but keep runtime-safe reconnect guard in place.
ensureRedisPublisher().catch((error) => {
    console.error('[Redis] Initial connect failed:', error);
});
