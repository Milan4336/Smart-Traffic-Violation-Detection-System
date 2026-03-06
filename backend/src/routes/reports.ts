import { Router, Request, Response } from 'express';
import prisma from '../prisma';
import { authenticateToken, AuthRequest, requireClearance } from '../middleware/auth';
import { buildViolationReportDocument } from '../services/reporting';

const router = Router();

// GET /api/reports - List generated report records
router.get('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<any> => {
    try {
        const limit = Math.min(200, Number(req.query.limit || 50));
        const page = Math.max(1, Number(req.query.page || 1));
        const violationId = req.query.violation_id ? String(req.query.violation_id) : undefined;
        const plateNumber = req.query.plate_number ? String(req.query.plate_number).toUpperCase() : undefined;
        const startDate = req.query.start_date ? new Date(String(req.query.start_date)) : undefined;
        const endDate = req.query.end_date ? new Date(String(req.query.end_date)) : undefined;

        const where: any = {};
        if (violationId) where.violationId = violationId;
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = startDate;
            if (endDate) where.createdAt.lte = endDate;
        }
        if (plateNumber) {
            where.violation = {
                is: {
                    plateNumber: { contains: plateNumber, mode: 'insensitive' }
                }
            };
        }

        const [reports, total] = await Promise.all([
            prisma.report.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: (page - 1) * limit,
                include: {
                    violation: {
                        select: {
                            id: true,
                            type: true,
                            plateNumber: true,
                            createdAt: true,
                            cameraId: true
                        }
                    },
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            role: true
                        }
                    }
                }
            }),
            prisma.report.count({ where })
        ]);

        return res.json({
            data: reports,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('Failed to fetch reports:', error);
        return res.status(500).json({ error: 'Failed to fetch reports' });
    }
});

// POST /api/reports/violations/:violationId - Create a report record for a violation
router.post('/violations/:violationId', authenticateToken, requireClearance(2), async (req: AuthRequest, res: Response): Promise<any> => {
    try {
        const violationId = String(req.params.violationId);
        const violation = await prisma.violation.findUnique({
            where: { id: violationId },
            include: { camera: true, vehicle: true }
        });

        if (!violation) {
            return res.status(404).json({ error: 'Violation not found' });
        }

        const { pdfBuffer, filename } = buildViolationReportDocument(violation);
        const report = await prisma.report.create({
            data: {
                violationId: violation.id,
                generatedBy: req.user!.id,
                fileName: filename,
                format: 'PDF',
                sizeBytes: pdfBuffer.byteLength
            }
        });

        await prisma.auditLog.create({
            data: {
                userId: req.user!.id,
                action: 'GENERATE_REPORT',
                entity: 'Report',
                entityId: report.id,
                details: violation.id
            }
        }).catch(() => undefined);

        return res.status(201).json({
            ...report,
            downloadUrl: `/api/reports/${report.id}/download`
        });
    } catch (error) {
        console.error('Failed to create report:', error);
        return res.status(500).json({ error: 'Failed to create report' });
    }
});

// GET /api/reports/:id/download - Download a generated report by report id
router.get('/:id/download', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    try {
        const reportId = String(req.params.id);
        const report = await prisma.report.findUnique({
            where: { id: reportId },
            include: {
                violation: {
                    include: {
                        camera: true,
                        vehicle: true
                    }
                }
            }
        });

        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }

        const { pdfBuffer, filename } = buildViolationReportDocument(report.violation);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.send(pdfBuffer);
    } catch (error) {
        console.error('Failed to download report:', error);
        return res.status(500).json({ error: 'Failed to download report' });
    }
});

// GET /api/reports/:id - Fetch single report metadata
router.get('/:id', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    try {
        const reportId = String(req.params.id);
        const report = await prisma.report.findUnique({
            where: { id: reportId },
            include: {
                violation: {
                    select: {
                        id: true,
                        type: true,
                        plateNumber: true,
                        cameraId: true,
                        createdAt: true
                    }
                },
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true
                    }
                }
            }
        });

        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }

        return res.json(report);
    } catch (error) {
        console.error('Failed to fetch report:', error);
        return res.status(500).json({ error: 'Failed to fetch report' });
    }
});

export default router;
