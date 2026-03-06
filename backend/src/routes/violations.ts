import { Router, Request, Response } from 'express';
import prisma from '../prisma';
import { publishJson } from '../redis';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';
import { updateOrCreateVehicle, calculateFine, createAlertIfNeeded, normalizeViolationType } from '../services/enforcement';
import { updateMetric } from '../services/metrics';
import { buildViolationReportDocument } from '../services/reporting';

const router = Router();
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'internal-secret-123';
const DUPLICATE_WINDOW_SECONDS = Number(process.env.DUPLICATE_WINDOW_SECONDS || 20);
const normalizePlateNumber = (value?: string | null): string | null => {
    if (!value) return null;
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return cleaned || null;
};

const authenticateInternal = (req: Request, res: Response, next: any): any => {
    if (req.headers['x-api-key'] === INTERNAL_API_KEY) {
        return next();
    }
    return res.status(401).json({ error: 'Unauthorized internal access' });
};

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

const buildSearchWhereClause = (query: any) => {
    const {
        plate_number,
        violation_type,
        camera_id,
        risk_level,
        fine_status,
        is_blacklisted,
        start_date,
        end_date
    } = query;

    const where: any = {};

    if (plate_number) {
        where.plateNumber = { contains: plate_number as string, mode: 'insensitive' };
    }
    if (violation_type && violation_type !== 'ALL') {
        where.type = normalizeViolationType(violation_type as string);
    }
    if (camera_id && camera_id !== 'ALL') {
        where.cameraId = camera_id as string;
    }
    if (fine_status && fine_status !== 'ALL') {
        where.fineStatus = fine_status as string;
    }
    if (query.review_status && query.review_status !== 'ALL') {
        where.reviewStatus = query.review_status as string;
    }

    const vehicleFilters: any = {};
    if (risk_level && risk_level !== 'ALL') {
        vehicleFilters.riskLevel = risk_level as string;
    }
    if (is_blacklisted !== undefined) {
        vehicleFilters.isBlacklisted = is_blacklisted === 'true';
    }
    if (Object.keys(vehicleFilters).length > 0) {
        where.vehicle = { is: vehicleFilters };
    }

    if (start_date || end_date) {
        where.createdAt = {};
        if (start_date) where.createdAt.gte = new Date(start_date as string);
        if (end_date) where.createdAt.lte = new Date(end_date as string);
    }

    return where;
};

// GET /api/violations/search - Advanced filtering and search
router.get('/search', authenticateToken, async (req: AuthRequest, res: Response): Promise<any> => {
    try {
        const sortByRaw = String(req.query.sort_by || 'createdAt');
        const sortOrderRaw = String(req.query.sort_order || 'desc').toLowerCase();
        const limit = parseInt(req.query.limit as string) || 20;
        const page = parseInt(req.query.page as string) || 1;
        const where = buildSearchWhereClause(req.query);
        const allowedSortFields = new Set(['createdAt', 'confidenceScore', 'fineAmount', 'type']);
        const sortBy = allowedSortFields.has(sortByRaw) ? sortByRaw : 'createdAt';
        const sortOrder = sortOrderRaw === 'asc' ? 'asc' : 'desc';

        const violations = await prisma.violation.findMany({
            where,
            orderBy: { [sortBy]: sortOrder },
            take: limit,
            skip: (page - 1) * limit,
            include: {
                camera: true,
                vehicle: true
            }
        });

        const total = await prisma.violation.count({ where });

        res.json({
            data: violations,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

// GET /api/violations - Get all with pagination & filters
router.get('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<any> => {
    try {
        const limit = parseInt(String(req.query.limit || 20));
        const page = parseInt(String(req.query.page || 1));
        const sortOrder = String(req.query.sort_order || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
        const where = buildSearchWhereClause(req.query);

        const [data, total] = await Promise.all([
            prisma.violation.findMany({
                where,
                orderBy: { createdAt: sortOrder },
                take: limit,
                skip: (page - 1) * limit,
                include: {
                    camera: true,
                    vehicle: true
                }
            }),
            prisma.violation.count({ where })
        ]);

        res.json({
            data,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch violations' });
    }
});

// POST /api/violations - Create new violation (Called by AI Service)
router.post('/', authenticateInternal, upload.single('evidenceImage'), async (req: Request, res: Response): Promise<any> => {
    try {
        const {
            type,
            violationType,
            plateNumber,
            vehicleNumber,
            vehicleType,
            confidenceScore,
            confidence,
            threatScore,
            cameraId,
            locationLat,
            locationLng,
            videoTimestampSeconds,
            boundingBox,
            dedupKey
        } = req.body;

        const resolvedType = normalizeViolationType(type || violationType);
        const resolvedPlateNumber = normalizePlateNumber((plateNumber || vehicleNumber || null) as string | null);
        const resolvedConfidence = Number(confidenceScore || confidence || 0);
        const parsedThreatScore = Number(threatScore || 0);
        const parsedVideoTimestamp = videoTimestampSeconds ? Number(videoTimestampSeconds) : null;
        const parsedLocationLat = locationLat ? Number(locationLat) : null;
        const parsedLocationLng = locationLng ? Number(locationLng) : null;
        const parsedBoundingBox = boundingBox ? (typeof boundingBox === 'string' ? JSON.parse(boundingBox) : boundingBox) : null;
        const parsedDedupKey = typeof dedupKey === 'string' ? dedupKey.slice(0, 128) : null;

        if (!resolvedType || !cameraId || Number.isNaN(resolvedConfidence)) {
            return res.status(400).json({ error: 'Missing required fields: type, cameraId, confidenceScore' });
        }

        const duplicateWindowStart = new Date(Date.now() - DUPLICATE_WINDOW_SECONDS * 1000);
        const duplicateWhere: any = {
            cameraId: String(cameraId),
            type: resolvedType,
            createdAt: {
                gte: duplicateWindowStart
            }
        };
        if (resolvedPlateNumber) {
            duplicateWhere.plateNumber = resolvedPlateNumber;
        } else if (parsedDedupKey) {
            duplicateWhere.dedupKey = parsedDedupKey;
        }

        const duplicateViolation = await prisma.violation.findFirst({
            where: duplicateWhere,
            orderBy: { createdAt: 'desc' },
            include: {
                camera: true,
                vehicle: true
            }
        });

        if (duplicateViolation) {
            return res.status(200).json({
                duplicate: true,
                violationId: duplicateViolation.id,
                data: duplicateViolation
            });
        }

        let evidenceImageUrl = null;
        if (req.file) {
            // Store the relative path accessible via static serving
            evidenceImageUrl = `/uploads/evidence/${req.file.filename}`;
        }

        // Feature 1: Repeat Offender Detection (must run before violation insert due FK relation on plateNumber)
        let vehicle = null;
        if (resolvedPlateNumber) {
            vehicle = await updateOrCreateVehicle(prisma, resolvedPlateNumber);
        }

        const violation = await prisma.violation.create({
            data: {
                type: resolvedType,
                plateNumber: resolvedPlateNumber,
                vehicleType,
                confidenceScore: resolvedConfidence,
                threatScore: Number.isNaN(parsedThreatScore) ? 0 : parsedThreatScore,
                cameraId: String(cameraId),
                locationLat: parsedLocationLat,
                locationLng: parsedLocationLng,
                evidenceImageUrl,
                videoTimestampSeconds: parsedVideoTimestamp,
                boundingBox: parsedBoundingBox,
                dedupKey: parsedDedupKey,
                reviewStatus: 'UNDER_REVIEW'
            },
            include: { camera: true }
        });

        // Feature 2: Automatic Fine Calculation
        const fineAmount = await calculateFine(prisma, resolvedType, vehicle?.totalViolations || 0);

        // Update violation with fine info
        const updatedViolation = await prisma.violation.update({
            where: { id: violation.id },
            data: {
                fineAmount,
                fineStatus: 'pending',
                fineGeneratedAt: new Date()
            }
        });

        // Re-fetch to include all relations for the broadcast
        const enrichedViolation = await prisma.violation.findUnique({
            where: { id: violation.id },
            include: { camera: true, vehicle: true }
        });

        // Publish event to Redis for real-time dashboard updates
        await publishJson('violation:new', enrichedViolation);

        // Emit fine generated event
        await publishJson('fine:generated', {
            violationId: violation.id,
            fineAmount,
            plateNumber: resolvedPlateNumber
        });

        // Feature 3: Critical alerts
        await createAlertIfNeeded(prisma, { ...updatedViolation, type: resolvedType }, vehicle);

        // Feature 9: Real-Time Live Metrics
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
        console.error('Error creating violation:', error);
        res.status(500).json({ error: 'Failed to create violation' });
    }
});

// POST /api/violations/:id/review - Review violation (ADMIN/OFFICER)
router.post('/:id/review', authenticateToken, requireRole(['ADMIN', 'OFFICER']), async (req: AuthRequest, res: Response): Promise<any> => {
    try {
        const { id } = req.params;
        const { decision, notes } = req.body; // decision: 'APPROVED' | 'REJECTED'

        if (!['APPROVED', 'REJECTED'].includes(decision)) {
            return res.status(400).json({ error: 'Invalid decision. Must be APPROVED or REJECTED.' });
        }

        const updateData: any = {
            reviewStatus: decision,
            reviewedBy: req.user!.id,
            reviewedAt: new Date(),
            reviewNotes: notes
        };

        // If rejected, waive the fine
        if (decision === 'REJECTED') {
            updateData.fineAmount = 0;
            updateData.fineStatus = 'waived';
        }

        const violation = await prisma.violation.update({
            where: { id: id as string },
            data: updateData,
            include: { camera: true, vehicle: true }
        });

        // Audit Log
        await prisma.auditLog.create({
            data: {
                userId: req.user!.id,
                action: `REVIEW_${decision}`,
                entity: 'Violation',
                entityId: id as string,
                details: notes
            }
        });

        // Broadcast review event
        await publishJson('violation:reviewed', violation);

        res.json(violation);
    } catch (error) {
        console.error('Review error:', error);
        res.status(500).json({ error: 'Failed to process violation review' });
    }
});

// PATCH /api/violations/:id/status - Update status (Legacy Verify/Reject/Dispatch)
router.patch('/:id/status', authenticateToken, requireRole(['ADMIN', 'OFFICER']), async (req: AuthRequest, res: Response): Promise<any> => {
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
        await publishJson('violation:verified', violation);

        res.json(violation);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update violation status' });
    }
});

// GET /api/violations/:id/report - Generate downloadable PDF evidence report
router.get('/:id/report', authenticateToken, async (req: AuthRequest, res: Response): Promise<any> => {
    try {
        const { id } = req.params;
        const violation = await prisma.violation.findUnique({
            where: { id: id as string },
            include: { camera: true, vehicle: true }
        });

        if (!violation) {
            return res.status(404).json({ error: 'Violation not found' });
        }

        const { pdfBuffer, filename } = buildViolationReportDocument(violation);

        if (req.user?.id) {
            await prisma.report.create({
                data: {
                    violationId: violation.id,
                    generatedBy: req.user.id,
                    fileName: filename,
                    format: 'PDF',
                    sizeBytes: pdfBuffer.byteLength
                }
            }).catch(() => undefined);

            await prisma.auditLog.create({
                data: {
                    userId: req.user.id,
                    action: 'DOWNLOAD_REPORT',
                    entity: 'Violation',
                    entityId: violation.id
                }
            }).catch(() => undefined);
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.send(pdfBuffer);
    } catch (error) {
        console.error('Failed to generate violation report:', error);
        return res.status(500).json({ error: 'Failed to generate report' });
    }
});

// GET /api/violations/:id/fine - Get fine calculation details
router.get('/:id/fine', authenticateToken, async (req: AuthRequest, res: Response): Promise<any> => {
    try {
        const { id } = req.params;
        const violation = await prisma.violation.findUnique({
            where: { id: id as string },
            include: { vehicle: true }
        });

        if (!violation) {
            return res.status(404).json({ error: 'Violation not found' });
        }

        // Fetch the rule used for calculation
        const normalizedType = normalizeViolationType(violation.type);
        const rule = await prisma.violationFineRule.findUnique({
            where: { violationType: normalizedType }
        }) || await prisma.violationFineRule.findUnique({
            where: { violationType: violation.type }
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
        const violation = await prisma.violation.findUnique({
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
                fineAmount: violation.fineAmount,
                reviewStatus: violation.reviewStatus,
                reviewNotes: violation.reviewNotes,
                reviewedBy: violation.reviewedBy,
                reviewedAt: violation.reviewedAt
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch evidence metadata' });
    }
});

export default router;
