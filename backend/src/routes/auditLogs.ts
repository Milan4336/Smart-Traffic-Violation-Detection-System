import { Router, Response } from 'express';
import prisma from '../prisma';
import { authenticateToken, AuthRequest, requireClearance } from '../middleware/auth';

const router = Router();

// GET /api/audit-logs - Global audit stream
router.get('/', authenticateToken, requireClearance(3), async (req: AuthRequest, res: Response): Promise<any> => {
    try {
        const limit = Math.min(500, Number(req.query.limit || 100));
        const page = Math.max(1, Number(req.query.page || 1));
        const action = req.query.action ? String(req.query.action) : undefined;
        const entity = req.query.entity ? String(req.query.entity) : undefined;
        const userId = req.query.user_id ? String(req.query.user_id) : undefined;
        const startDate = req.query.start_date ? new Date(String(req.query.start_date)) : undefined;
        const endDate = req.query.end_date ? new Date(String(req.query.end_date)) : undefined;

        const where: any = {};
        if (action) where.action = action;
        if (entity) where.entity = entity;
        if (userId) where.userId = userId;
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = startDate;
            if (endDate) where.createdAt.lte = endDate;
        }

        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: (page - 1) * limit,
                include: {
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
            prisma.auditLog.count({ where })
        ]);

        return res.json({
            data: logs,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('Failed to fetch audit logs:', error);
        return res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
});

export default router;
