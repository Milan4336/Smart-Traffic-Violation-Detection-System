"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../prisma"));
const router = (0, express_1.Router)();
// GET /api/updates
router.get('/', async (req, res) => {
    try {
        const updates = await prisma_1.default.systemUpdate.findMany({
            orderBy: { createdAt: 'desc' },
            take: 10
        });
        // Seed some mock updates if empty
        if (updates.length === 0) {
            const mockUpdates = [
                { version: '2.4.1', title: 'System Patch Applied', description: 'Auto-deployed fix for Cam-09 latency.' },
                { version: '2.4.0', title: 'Model Upgrade', description: 'Upgraded AI detection model to YOLOv8-nano.' }
            ];
            await prisma_1.default.systemUpdate.createMany({ data: mockUpdates });
            return res.json(await prisma_1.default.systemUpdate.findMany({ orderBy: { createdAt: 'desc' } }));
        }
        res.json(updates);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch updates' });
    }
});
exports.default = router;
//# sourceMappingURL=updates.js.map