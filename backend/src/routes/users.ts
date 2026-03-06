import { Router, Response } from 'express';
import prisma from '../prisma';
import bcrypt from 'bcrypt';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/users - List all users (ADMIN only)
router.get('/', authenticateToken, requireRole(['ADMIN']), async (req: AuthRequest, res: Response): Promise<any> => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                clearanceLevel: true,
                isActive: true,
                createdAt: true,
                lastLogin: true
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// POST /api/users - Create new user (ADMIN only)
router.post('/', authenticateToken, requireRole(['ADMIN']), async (req: AuthRequest, res: Response): Promise<any> => {
    try {
        const { name, email, password, role, clearanceLevel } = req.body;

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) return res.status(400).json({ error: 'User already exists.' });

        const passwordHash = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                name,
                email,
                passwordHash,
                role: role.toUpperCase(),
                clearanceLevel: parseInt(clearanceLevel.toString()) || 1
            }
        });

        // Audit Log
        await prisma.auditLog.create({
            data: {
                userId: req.user!.id,
                action: 'CREATE_USER',
                entity: 'User',
                entityId: user.id
            }
        });

        res.status(201).json({ id: user.id, name: user.name, email: user.email });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create user' });
    }
});

// PATCH /api/users/:id - Update user role/status (ADMIN only)
router.patch('/:id', authenticateToken, requireRole(['ADMIN']), async (req: AuthRequest, res: Response): Promise<any> => {
    try {
        const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const { role, clearanceLevel, isActive } = req.body;

        const user = await prisma.user.update({
            where: { id: userId },
            data: {
                ...(role && { role: role.toUpperCase() }),
                ...(clearanceLevel !== undefined && { clearanceLevel: parseInt(clearanceLevel.toString()) }),
                ...(isActive !== undefined && { isActive })
            }
        });

        // Audit Log
        await prisma.auditLog.create({
            data: {
                userId: req.user!.id,
                action: 'UPDATE_USER',
                entity: 'User',
                entityId: userId
            }
        });

        res.json({ id: user.id, role: user.role, isActive: user.isActive });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// DELETE /api/users/:id - Delete user (ADMIN only)
router.delete('/:id', authenticateToken, requireRole(['ADMIN']), async (req: AuthRequest, res: Response): Promise<any> => {
    try {
        const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

        if (userId === req.user!.id) {
            return res.status(400).json({ error: 'Cannot delete yourself.' });
        }

        await prisma.user.delete({ where: { id: userId } });

        // Audit Log
        await prisma.auditLog.create({
            data: {
                userId: req.user!.id,
                action: 'DELETE_USER',
                entity: 'User',
                entityId: userId
            }
        });

        res.json({ message: 'User deleted successfully.' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

export default router;
