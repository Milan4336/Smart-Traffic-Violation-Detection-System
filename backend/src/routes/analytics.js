"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../prisma"));
const router = (0, express_1.Router)();
// GET /api/analytics
router.get('/', async (req, res) => {
    try {
        const totalViolations = await prisma_1.default.violation.count();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayViolations = await prisma_1.default.violation.count({
            where: {
                timestamp: {
                    gte: today
                }
            }
        });
        const activeCameras = await prisma_1.default.camera.count({
            where: { status: 'ONLINE' }
        });
        res.json({
            metrics: {
                totalViolations,
                todayViolations,
                activeCameras,
                aiConfidenceAverage: 99.8 // Mocked based on UI
            }
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});
exports.default = router;
//# sourceMappingURL=analytics.js.map