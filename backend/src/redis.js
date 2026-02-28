"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisPublisher = void 0;
const redis_1 = require("redis");
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
exports.redisPublisher = (0, redis_1.createClient)({ url: redisUrl });
exports.redisPublisher.on('error', (err) => console.error('Redis Publisher Error', err));
// Connect automatically
(async () => {
    await exports.redisPublisher.connect();
})();
//# sourceMappingURL=redis.js.map