import { Router, Request, Response } from 'express';
import prisma from '../prisma';
import { redisPublisher } from '../redis';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateToken, requireClearance, AuthRequest } from '../middleware/auth';
import { updateOrCreateVehicle, calculateFine, createAlertIfNeeded } from '../services/enforcement';

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

        const violations = await (prisma as any).violation.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: (page - 1) * limit,
            include: {
                camera: true,
                vehicle: true
            }
        });

        const total = await (prisma as any).violation.count({ where: whereClause });

        res.json({ data: violations, total, page, limit });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch violations' });
    }
});

// POST /api/violations - Create new violation (Called by AI Service)
router.post('/', upload.single('evidenceImage'), async (req: Request, res: Response): Promise<any> => {
    try {
        const {
            type,
            plateNumber,
            vehicleType,
            confidenceScore,
            threatScore,
            cameraId,
            locationLat,
            locationLng,
            videoTimestampSeconds,
            boundingBox
        } = req.body;

        let evidenceImageUrl = null;
        if (req.file) {
            // Store the relative path accessible via static serving
            evidenceImageUrl = `/uploads/evidence/${req.file.filename}`;
        }

        const violation = await (prisma as any).violation.create({
            data: {
                type,
                plateNumber,
                vehicleType,
                confidenceScore: parseFloat(confidenceScore),
                threatScore: threatScore ? parseFloat(threatScore) : 0,
                cameraId,
                locationLat: locationLat ? parseFloat(locationLat) : null,
                locationLng: locationLng ? parseFloat(locationLng) : null,
                evidenceImageUrl,
                videoTimestampSeconds: videoTimestampSeconds ? parseFloat(videoTimestampSeconds) : null,
                boundingBox: boundingBox ? (typeof boundingBox === 'string' ? JSON.parse(boundingBox) : boundingBox) : null
            },
            include: { camera: true }
        });

        // Feature 1: Repeat Offender Detection
        let vehicle = null;
        if (plateNumber) {
            vehicle = await updateOrCreateVehicle(prisma, plateNumber);
        }

        // Feature 2: Automatic Fine Calculation
        const fineAmount = await calculateFine(prisma, type, vehicle?.totalViolations || 0);

        // Update violation with fine info
        const updatedViolation = await (prisma as any).violation.update({
            where: { id: violation.id },
            data: {
                fineAmount,
                fineStatus: 'pending',
                fineGeneratedAt: new Date()
            }
        });

        // Re-fetch to include all relations for the broadcast
        const enrichedViolation = await (prisma as any).violation.findUnique({
            where: { id: violation.id },
            include: { camera: true, vehicle: true }
        });

        // Publish event to Redis for real-time dashboard updates
        await redisPublisher.publish('violation:new', JSON.stringify(enrichedViolation));

        // Emit fine generated event
        await redisPublisher.publish('fine:generated', JSON.stringify({
            violationId: violation.id,
            fineAmount,
            plateNumber
        }));

        // Feature 3: Critical alerts
        await createAlertIfNeeded(prisma, updatedViolation, vehicle);

        res.status(201).json(enrichedViolation);
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
            where: { id: id as string },
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
                entityId: id as string,
            }
        });

        // Broadcast status change
        await redisPublisher.publish('violation:verified', JSON.stringify(violation));

        res.json(violation);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update violation status' });
    }
});

// GET /api/violations/:id/fine - Get fine calculation details
router.get('/:id/fine', authenticateToken, async (req: AuthRequest, res: Response): Promise<any> => {
    try {
        const { id } = req.params;
        const violation = await (prisma as any).violation.findUnique({
            where: { id: id as string },
            include: { vehicle: true }
        });

        if (!violation) {
            return res.status(404).json({ error: 'Violation not found' });
        }

        // Fetch the rule used for calculation
        const rule = await (prisma as any).violationFineRule.findUnique({
            where: { violationType: violation.type }
        }) || await (prisma as any).violationFineRule.findUnique({
            where: { violationType: violation.type.toUpperCase() }
        });

        const vehicleCount = violation.vehicle?.totalViolations || 0;
        const multiplier = rule?.repeatMultiplier || 1.0;
        let appliedMultiplier = 1.0;

        if (vehicleCount >= 10) appliedMultiplier = multiplier * 1.5;
        else if (vehicleCount >= 3) appliedMultiplier = multiplier;

        res.json({
            fineAmount: violation.fineAmount,
            fineStatus: violation.fineStatus,
            fineGeneratedAt: violation.fineGeneratedAt,
            violationType: violation.type,
            plateNumber: violation.plateNumber,
            calculation: {
                baseAmount: rule?.baseAmount || 0,
                repeatMultiplier: multiplier,
                appliedMultiplier,
                vehicleViolationCount: vehicleCount,
                riskLevel: violation.vehicle?.riskLevel || 'LOW'
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch fine details' });
    }
});

// GET /api/violations/:id/evidence - Get specialized evidence data for the viewer
router.get('/:id/evidence', authenticateToken, async (req: AuthRequest, res: Response): Promise<any> => {
    try {
        const { id } = req.params;
        const violation = await (prisma as any).violation.findUnique({
            where: { id: id as string },
            include: { camera: true }
        });

        if (!violation) {
            return res.status(404).json({ error: 'Violation not found' });
        }

        res.json({
            imageUrl: violation.evidenceImageUrl,
            videoUrl: violation.evidenceVideoPath,
            timestampSeconds: violation.videoTimestampSeconds,
            boundingBox: violation.boundingBox,
            metadata: {
                plateNumber: violation.plateNumber,
                type: violation.type,
                confidence: violation.confidenceScore,
                cameraId: violation.cameraId,
                cameraName: violation.camera?.name,
                location: { lat: violation.locationLat, lng: violation.locationLng },
                time: violation.createdAt,
                fineAmount: violation.fineAmount
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch evidence metadata' });
    }
});

export default router;
