import { Router, Request, Response } from 'express';
import prisma from '../prisma';
import { redisPublisher } from '../redis';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateToken, requireClearance, AuthRequest } from '../middleware/auth';

const router = Router();

// Configure storage for evidence media
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../../uploads/evidence');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`);
    }
});
const upload = multer({ storage });

// GET /api/violations - Get all with pagination & filters
router.get('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<any> => {
    try {
        const limit = parseInt(req.query.limit as string) || 50;
        const page = parseInt(req.query.page as string) || 1;
        const status = req.query.status as string;

        const whereClause = status ? { status } : {};

        const violations = await prisma.violation.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: (page - 1) * limit,
            include: { camera: true }
        });

        const total = await prisma.violation.count({ where: whereClause });

        res.json({ data: violations, total, page, limit });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch violations' });
    }
});

// POST /api/violations - Create new violation (Called by AI Service)
router.post('/', upload.single('evidenceImage'), async (req: Request, res: Response): Promise<any> => {
    try {
        const { type, plateNumber, vehicleType, confidenceScore, threatScore, cameraId, locationLat, locationLng } = req.body;

        let evidenceImageUrl = null;
        if (req.file) {
            // Store the relative path accessible via static serving
            evidenceImageUrl = `/uploads/evidence/${req.file.filename}`;
        }

        const violation = await prisma.violation.create({
            data: {
                type,
                plateNumber,
                vehicleType,
                confidenceScore: parseFloat(confidenceScore),
                threatScore: threatScore ? parseFloat(threatScore) : 0,
                cameraId,
                locationLat: locationLat ? parseFloat(locationLat) : null,
                locationLng: locationLng ? parseFloat(locationLng) : null,
                evidenceImageUrl
            },
            include: { camera: true }
        });

        // Publish event to Redis for real-time dashboard updates
        await redisPublisher.publish('violation:new', JSON.stringify(violation));

        res.status(201).json(violation);
    } catch (error) {
        console.error('Error creating violation:', error);
        res.status(500).json({ error: 'Failed to create violation' });
    }
});

// PATCH /api/violations/:id/status - Update status (Verify/Reject/Dispatch)
router.patch('/:id/status', authenticateToken, requireClearance(2), async (req: AuthRequest, res: Response): Promise<any> => {
    try {
        const { id } = req.params;
        const { status } = req.body; // 'verified', 'rejected', 'dispatched'

        const violation = await prisma.violation.update({
            where: { id },
            data: {
                status,
                verifiedBy: req.user!.id,
                verifiedAt: new Date()
            },
            include: { camera: true }
        });

        // Audit Log
        await prisma.auditLog.create({
            data: {
                userId: req.user!.id,
                action: 'UPDATE_STATUS',
                entity: 'Violation',
                entityId: id,
            }
        });

        // Broadcast status change
        await redisPublisher.publish('violation:verified', JSON.stringify(violation));

        res.json(violation);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update violation status' });
    }
});

export default router;
