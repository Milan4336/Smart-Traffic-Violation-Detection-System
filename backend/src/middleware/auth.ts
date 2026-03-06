import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../prisma';
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

export interface AuthRequest extends Request {
    user?: {
        id: string;
        role: string;
        clearanceLevel: number;
        isActive: boolean;
    };
}

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction): Promise<any> => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;

        // Check if user still exists and is active
        const user = await prisma.user.findUnique({ where: { id: decoded.id } });
        if (!user) {
            return res.status(401).json({ error: 'User no longer exists.' });
        }
        if (!user.isActive) {
            return res.status(403).json({ error: 'Account is disabled. Contact administrator.' });
        }

        req.user = {
            id: user.id,
            role: user.role,
            clearanceLevel: user.clearanceLevel,
            isActive: user.isActive
        };

        next();
    } catch (error) {
        res.status(403).json({ error: 'Invalid token.' });
    }
};

export const requireRole = (roles: string[]) => {
    return async (req: AuthRequest, res: Response, next: NextFunction): Promise<any> => {
        if (!req.user || !roles.includes(req.user.role.toUpperCase())) {
            // Log unauthorized attempt
            if (req.user) {
                await prisma.auditLog.create({
                    data: {
                        userId: req.user.id,
                        action: 'UNAUTHORIZED_ATTEMPT',
                        entity: 'API_ENDPOINT',
                        entityId: req.originalUrl
                    }
                }).catch(err => console.error("Failed to log unauthorized attempt", err));
            }

            return res.status(403).json({ error: `Access denied. Requires one of roles: ${roles.join(', ')}` });
        }
        next();
    };
};

export const requireClearance = (level: number) => {
    return (req: AuthRequest, res: Response, next: NextFunction): any => {
        if (!req.user || req.user.clearanceLevel < level) {
            return res.status(403).json({ error: 'Insufficient clearance level.' });
        }
        next();
    };
};
