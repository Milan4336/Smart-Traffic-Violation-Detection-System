import { Router, Request, Response } from 'express';
import prisma from '../prisma';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// GET /api/vehicles/:plate_number - Get vehicle violation history and risk level
router.get('/:plate_number', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    try {
        const { plate_number } = req.params;

        const vehicle = await (prisma as any).vehicle.findUnique({
            where: { plateNumber: plate_number },
            include: {
                violations: {
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                    include: { camera: true }
                },
                videoViolations: {
                    orderBy: { createdAt: 'desc' },
                    take: 10
                }
            }
        });

        if (!vehicle) {
            return res.status(404).json({ error: 'Vehicle not found' });
        }

        res.json(vehicle);
    } catch (error) {
        console.error('Error fetching vehicle details:', error);
        res.status(500).json({ error: 'Failed to fetch vehicle details' });
    }
});

export default router;
