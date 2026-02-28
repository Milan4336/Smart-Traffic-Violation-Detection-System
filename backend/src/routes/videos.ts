import { Router, Request, Response } from 'express';
import prisma from '../prisma';
import { redisPublisher } from '../redis';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { updateOrCreateVehicle, calculateFine, createAlertIfNeeded } from '../services/enforcement';
import crypto from 'crypto';

const router = Router();
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'internal-secret-123';

// Middleware to check internal API key
const authenticateInternal = (req: any, res: Response, next: any) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey === INTERNAL_API_KEY) {
        return next();
    }
    res.status(401).json({ error: 'Unauthorized internal access' });
};

// Configure storage for video uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../../uploads/videos');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${crypto.randomUUID()}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.mp4', '.avi', '.mov'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only MP4, AVI, and MOV are allowed.'));
        }
    }
});

// POST /api/videos/upload - Upload and queue video for processing
router.post('/upload', authenticateToken, upload.single('video'), async (req: AuthRequest, res: Response): Promise<any> => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No video file provided' });
        }

        const video = await prisma.uploadedVideo.create({
            data: {
                uploadedBy: req.user!.id,
                filePath: `/uploads/videos/${req.file.filename}`,
                status: 'queued'
            }
        });

        // Push to Redis queue for AI processing
        await redisPublisher.lpush('video:queue', JSON.stringify({
            videoId: video.id,
            filePath: path.join(__dirname, '../../', video.filePath),
            userId: req.user!.id
        }));

        res.status(201).json(video);
    } catch (error) {
        console.error('Error uploading video:', error);
        res.status(500).json({ error: 'Failed to upload video' });
    }
});

// GET /api/videos - Get user's video uploads
router.get('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<any> => {
    try {
        const videos = await prisma.uploadedVideo.findMany({
            where: { uploadedBy: req.user!.id },
            orderBy: { uploadedAt: 'desc' },
            include: {
                _count: {
                    select: { violations: true }
                }
            }
        });
        res.json(videos);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch videos' });
    }
});

// GET /api/videos/:id - Get specific video details with violations
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response): Promise<any> => {
    try {
        const { id } = req.params;
        const video = await (prisma as any).uploadedVideo.findUnique({
            where: { id: id as string },
            include: {
                violations: {
                    orderBy: { frameTimestamp: 'asc' },
                    include: { vehicle: true }
                }
            }
        });

        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }

        res.json(video);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch video details' });
    }
});

// --- INTERNAL ENDPOINTS (Called by AI Service) ---

// PATCH /api/videos/:id/status - Update video processing status
router.patch('/:id/status', authenticateInternal, async (req: Request, res: Response): Promise<any> => {
    try {
        const id = req.params.id as string;
        const { status, durationSeconds } = req.body;

        const updateData: any = { status };
        if (status === 'completed') {
            updateData.processedAt = new Date();
        }
        if (durationSeconds) {
            updateData.durationSeconds = parseFloat(durationSeconds);
        }

        const video = await (prisma as any).uploadedVideo.update({
            where: { id },
            data: updateData
        });

        // Notify frontend via Redis/Socket
        await redisPublisher.publish('video:status', JSON.stringify({
            videoId: id,
            status,
            userId: video.uploadedBy
        }));

        res.json(video);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update video status' });
    }
});

// POST /api/videos/:id/violations - Add a violation detected in a video
router.post('/:id/violations', authenticateInternal, async (req: Request, res: Response): Promise<any> => {
    try {
        const id = req.params.id as string;
        const { violationType, confidenceScore, frameTimestamp, plateNumber, boundingBox, evidenceImagePath } = req.body;

        const violation = await (prisma as any).videoViolation.create({
            data: {
                videoId: id,
                violationType,
                confidenceScore: parseFloat(confidenceScore),
                frameTimestamp: parseFloat(frameTimestamp),
                plateNumber,
                boundingBox,
                evidenceImagePath
            }
        });

        // Feature 1: Repeat Offender Detection
        let vehicle = null;
        if (plateNumber) {
            vehicle = await updateOrCreateVehicle(prisma, plateNumber);
        }

        // Feature 2: Automatic Fine Calculation
        const fineAmount = await calculateFine(prisma, violationType, vehicle?.totalViolations || 0);

        // Update violation with fine info
        await (prisma as any).videoViolation.update({
            where: { id: violation.id },
            data: {
                fineAmount,
                fineStatus: 'pending',
                fineGeneratedAt: new Date()
            }
        });

        // Notify frontend
        const enrichedViolation = await (prisma as any).videoViolation.findUnique({
            where: { id: violation.id },
            include: { vehicle: true }
        });

        const videoRecord = await (prisma as any).uploadedVideo.findUnique({ where: { id } });
        await redisPublisher.publish('video:violation', JSON.stringify({
            videoId: id,
            violation: enrichedViolation,
            userId: videoRecord?.uploadedBy
        }));

        // Emit fine generated event
        await redisPublisher.publish('fine:generated', JSON.stringify({
            violationId: violation.id,
            fineAmount,
            plateNumber
        }));

        // Feature 3: Critical alerts
        await createAlertIfNeeded(prisma, enrichedViolation, vehicle);

        res.status(201).json(enrichedViolation);
    } catch (error) {
        console.error('Error creating video violation:', error);
        res.status(500).json({ error: 'Failed to create video violation' });
    }
});

export default router;
