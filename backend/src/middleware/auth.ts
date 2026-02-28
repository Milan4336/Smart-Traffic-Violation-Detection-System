import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

export interface AuthRequest extends Request {
    user?: {
        id: string;
        role: string;
        clearanceLevel: number;
    };
}

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction): Promise<any> => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        req.user = decoded;

        // Check if user still exists
        const user = await prisma.user.findUnique({ where: { id: decoded.id } });
        if (!user) {
            return res.status(401).json({ error: 'User no longer exists.' });
        }

        next();
    } catch (error) {
        res.status(403).json({ error: 'Invalid token.' });
    }
};

export const requireClearance = (level: number) => {
    return (req: AuthRequest, res: Response, next: NextFunction): any => {
        if (!req.user || req.user.clearanceLevel < level) {
            return res.status(403).json({ error: 'Insufficient clearance level.' });
        }
        next();
    };
};
