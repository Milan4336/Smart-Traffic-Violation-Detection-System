import { Router, Request, Response } from 'express';
import prisma from '../prisma';
import { publishJson, pushJsonToQueue } from '../redis';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { updateOrCreateVehicle, calculateFine, normalizeViolationType } from '../services/enforcement';
import { updateMetric } from '../services/metrics';
import crypto from 'crypto';

const router = Router();
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'internal-secret-123';
const VIDEO_DUPLICATE_WINDOW_SECONDS = 2;
const normalizePlateNumber = (value?: string | null): string | null => {
    if (!value) return null;
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return cleaned || null;
};

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
        await pushJsonToQueue('video:queue', {
            videoId: video.id,
            filePath: path.join('/app', video.filePath.replace(/^\/+/, '')),
            userId: req.user!.id
        });

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

// GET /api/videos/violations/:violationId/evidence - Evidence payload for video violation rows
router.get('/violations/:violationId/evidence', authenticateToken, async (req: AuthRequest, res: Response): Promise<any> => {
    try {
        const { violationId } = req.params;
        const violation = await prisma.videoViolation.findUnique({
            where: { id: violationId as string },
            include: {
                video: true
            }
        });

        if (!violation) {
            return res.status(404).json({ error: 'Video violation not found' });
        }

        if (violation.video.uploadedBy !== req.user!.id && req.user!.role.toUpperCase() !== 'ADMIN') {
            return res.status(403).json({ error: 'Access denied for this evidence' });
        }

        res.json({
            source: 'VIDEO_UPLOAD',
            imageUrl: violation.evidenceImagePath,
            videoUrl: violation.evidenceVideoPath || violation.video.filePath,
            timestampSeconds: violation.videoTimestampSeconds ?? violation.frameTimestamp,
            boundingBox: violation.boundingBox,
            metadata: {
                plateNumber: violation.plateNumber,
                type: normalizeViolationType(violation.violationType),
                confidence: violation.confidenceScore,
                cameraId: 'VIDEO_UPLOAD',
                cameraName: 'Uploaded Video',
                location: { lat: null, lng: null },
                time: violation.createdAt,
                fineAmount: violation.fineAmount
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch video evidence' });
    }
});

// GET /api/videos/:id - Get specific video details with violations
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response): Promise<any> => {
    try {
        const { id } = req.params;
        const video = await prisma.uploadedVideo.findUnique({
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

        if (video.uploadedBy !== req.user!.id && req.user!.role.toUpperCase() !== 'ADMIN') {
            return res.status(403).json({ error: 'Access denied for this video' });
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
        if (durationSeconds !== undefined && durationSeconds !== null) {
            updateData.durationSeconds = parseFloat(durationSeconds);
        }

        const video = await prisma.uploadedVideo.update({
            where: { id },
            data: updateData
        });

        // Notify frontend via Redis/Socket
        await publishJson('video:status', {
            videoId: id,
            status,
            userId: video.uploadedBy
        });

        res.json(video);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update video status' });
    }
});

// POST /api/videos/:id/violations - Add a violation detected in a video
router.post('/:id/violations', authenticateInternal, async (req: Request, res: Response): Promise<any> => {
    try {
        const id = req.params.id as string;
        const { violationType, confidenceScore, frameTimestamp, plateNumber, boundingBox, evidenceImagePath, dedupKey } = req.body;
        const normalizedType = normalizeViolationType(violationType);
        const normalizedPlate = normalizePlateNumber(plateNumber);
        const parsedFrameTimestamp = parseFloat(frameTimestamp);
        const parsedConfidence = parseFloat(confidenceScore);
        const parsedBoundingBox = boundingBox ? (typeof boundingBox === 'string' ? JSON.parse(boundingBox) : boundingBox) : null;
        const parsedDedupKey = typeof dedupKey === 'string' ? dedupKey.slice(0, 128) : null;

        if (!normalizedType || Number.isNaN(parsedFrameTimestamp) || Number.isNaN(parsedConfidence)) {
            return res.status(400).json({ error: 'Invalid violation payload' });
        }

        const duplicateWhere: any = {
            videoId: id,
            violationType: normalizedType,
            frameTimestamp: {
                gte: parsedFrameTimestamp - VIDEO_DUPLICATE_WINDOW_SECONDS,
                lte: parsedFrameTimestamp + VIDEO_DUPLICATE_WINDOW_SECONDS
            }
        };
        if (normalizedPlate) {
            duplicateWhere.plateNumber = normalizedPlate;
        } else if (parsedDedupKey) {
            duplicateWhere.dedupKey = parsedDedupKey;
        }

        const duplicate = await prisma.videoViolation.findFirst({
            where: duplicateWhere,
            orderBy: { createdAt: 'desc' }
        });

        if (duplicate) {
            return res.status(200).json({
                duplicate: true,
                violationId: duplicate.id
            });
        }

        // Ensure vehicle row exists before creating VideoViolation (FK on plateNumber).
        let vehicle = null;
        if (normalizedPlate) {
            vehicle = await updateOrCreateVehicle(prisma, normalizedPlate);
        }

        const violation = await prisma.videoViolation.create({
            data: {
                videoId: id,
                violationType: normalizedType,
                confidenceScore: parsedConfidence,
                frameTimestamp: parsedFrameTimestamp,
                videoTimestampSeconds: req.body.videoTimestampSeconds ? parseFloat(req.body.videoTimestampSeconds) : parsedFrameTimestamp,
                plateNumber: normalizedPlate,
                boundingBox: parsedBoundingBox,
                dedupKey: parsedDedupKey,
                evidenceImagePath,
                evidenceVideoPath: req.body.evidenceVideoPath || null
            }
        });

        // Feature 2: Automatic Fine Calculation
        const fineAmount = await calculateFine(prisma, normalizedType, vehicle?.totalViolations || 0);

        // Update violation with fine info
        await prisma.videoViolation.update({
            where: { id: violation.id },
            data: {
                fineAmount,
                fineStatus: 'pending',
                fineGeneratedAt: new Date()
            }
        });

        // Notify frontend
        const enrichedViolation = await prisma.videoViolation.findUnique({
            where: { id: violation.id },
            include: { vehicle: true }
        });

        const videoRecord = await prisma.uploadedVideo.findUnique({ where: { id } });
        await publishJson('video:violation', {
            videoId: id,
            violation: enrichedViolation,
            userId: videoRecord?.uploadedBy
        });

        // Emit fine generated event
        await publishJson('fine:generated', {
            violationId: violation.id,
            fineAmount,
            plateNumber: normalizedPlate
        });

        await updateMetric('violations_today', 1);
        await updateMetric('violations_hour', 1);
        if (fineAmount > 0) {
            await updateMetric('fines_today', fineAmount);
        }
        if (vehicle && vehicle.totalViolations > 1) {
            await updateMetric('repeat_offenders_today', 1);
        }

        res.status(201).json(enrichedViolation);
    } catch (error) {
        console.error('Error creating video violation:', error);
        res.status(500).json({ error: 'Failed to create video violation' });
    }
});

export default router;
