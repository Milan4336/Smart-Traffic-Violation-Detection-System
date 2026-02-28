"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../prisma"));
const redis_1 = require("../redis");
const router = (0, express_1.Router)();
// GET /api/violations
router.get('/', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const violations = await prisma_1.default.violation.findMany({
            orderBy: { timestamp: 'desc' },
            take: limit,
            include: { camera: true }
        });
        res.json(violations);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch violations' });
    }
});
// POST /api/violations
router.post('/', async (req, res) => {
    try {
        const { vehicleNumber, violationType, confidence, cameraId, location } = req.body;
        const violation = await prisma_1.default.violation.create({
            data: {
                vehicleNumber,
                violationType,
                confidence,
                cameraId,
                location,
                timestamp: new Date()
            },
            include: { camera: true }
        });
        // Publish event to Redis
        await redis_1.redisPublisher.publish('new_violation', JSON.stringify(violation));
        res.status(201).json(violation);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create violation' });
    }
});
exports.default = router;
//# sourceMappingURL=violations.js.map