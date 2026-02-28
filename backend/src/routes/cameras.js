"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../prisma"));
const router = (0, express_1.Router)();
// GET /api/cameras
router.get('/', async (req, res) => {
    try {
        const cameras = await prisma_1.default.camera.findMany();
        // Return mock data if db is empty for demonstration purposes
        if (cameras.length === 0) {
            const mockCameras = [
                { id: 'cam-01', name: 'CAM-01', location: 'Intersection 4B - North', status: 'ONLINE' },
                { id: 'cam-02', name: 'CAM-02', location: 'Main Street Bridge', status: 'ONLINE' },
                { id: 'cam-03', name: 'CAM-03', location: 'District 9 Gate', status: 'LATENCY' },
                { id: 'cam-04', name: 'CAM-04', location: 'Sector 7G Checkpoint', status: 'OFFLINE' }
            ];
            // Seed them
            await prisma_1.default.camera.createMany({ data: mockCameras });
            return res.json(await prisma_1.default.camera.findMany());
        }
        res.json(cameras);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch cameras' });
    }
});
exports.default = router;
//# sourceMappingURL=cameras.js.map