import { Router, Request, Response } from 'express';
import prisma from '../prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/vehicles/:plateNumber/profile - Get full vehicle intelligence profile
router.get('/:plateNumber/profile', authenticateToken, async (req: AuthRequest, res: Response): Promise<any> => {
    try {
        const { plateNumber } = req.params;

        const vehicle = await (prisma as any).vehicle.findUnique({
            where: { plateNumber },
            include: {
                violations: {
                    orderBy: { createdAt: 'desc' },
                    include: { camera: true }
                },
                videoViolations: {
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!vehicle) {
            return res.status(404).json({ error: 'Vehicle profile not found' });
        }

        // Combine violations and videoViolations for a unified timeline
        const allViolations = [
            ...vehicle.violations.map((v: any) => ({
                id: v.id,
                type: v.type,
                timestamp: v.createdAt,
                location: { lat: v.locationLat, lng: v.locationLng },
                fineAmount: v.fineAmount || 0,
                confidenceScore: v.confidenceScore,
                cameraId: v.cameraId,
                cameraName: v.camera?.name,
                source: 'LIVE'
            })),
            ...(vehicle as any).videoViolations.map((v: any) => ({
                id: v.id,
                type: v.violationType,
                timestamp: v.createdAt,
                location: null, // Video uploads usually don't have lat/lng unless metadata is parsed
                fineAmount: v.fineAmount || 0,
                confidenceScore: v.confidenceScore,
                cameraId: 'UPLOAD',
                cameraName: 'VIDEO_UPLOAD',
                source: 'FILE'
            }))
        ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        // Intelligence Metrics
        const totalFines = allViolations.reduce((sum: number, v: any) => sum + v.fineAmount, 0);
        const firstSeen = allViolations.length > 0 ? allViolations[allViolations.length - 1].timestamp : vehicle.createdAt;
        const lastSeen = allViolations.length > 0 ? allViolations[0].timestamp : vehicle.createdAt;
        const lastCameraId = allViolations.length > 0 ? allViolations[0].cameraId : 'UNKNOWN';

        // Violation type distribution
        const typeCounts: Record<string, number> = {};
        allViolations.forEach((v: any) => {
            typeCounts[v.type] = (typeCounts[v.type] || 0) + 1;
        });
        const mostCommonType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

        // Average violations per week
        const weeksDiff = Math.max(1, Math.ceil((new Date(lastSeen).getTime() - new Date(firstSeen).getTime()) / (1000 * 60 * 60 * 24 * 7)));
        const avgViolationsPerWeek = (allViolations.length / weeksDiff).toFixed(2);

        // Highest fine
        const highestFineViolation = allViolations.length > 0 ? allViolations.reduce((prev, curr) => (prev.fineAmount > curr.fineAmount) ? prev : curr) : null;

        res.json({
            summary: {
                plateNumber: vehicle.plateNumber,
                totalViolations: vehicle.totalViolations,
                riskLevel: vehicle.riskLevel,
                isBlacklisted: vehicle.isBlacklisted,
                totalFines,
                firstSeen,
                lastSeen,
                lastCameraId,
            },
            analytics: {
                mostCommonType,
                avgViolationsPerWeek: parseFloat(avgViolationsPerWeek),
                highestFine: {
                    amount: highestFineViolation?.fineAmount || 0,
                    type: highestFineViolation?.type || 'N/A'
                }
            },
            history: allViolations
        });
    } catch (error) {
        console.error('Error fetching vehicle profile:', error);
        res.status(500).json({ error: 'Failed to fetch vehicle profile' });
    }
});

// PATCH /api/vehicles/:plateNumber/blacklist - Toggle blacklist status
router.patch('/:plateNumber/blacklist', authenticateToken, async (req: AuthRequest, res: Response): Promise<any> => {
    try {
        const { plateNumber } = req.params;
        const { isBlacklisted } = req.body;

        const vehicle = await (prisma as any).vehicle.update({
            where: { plateNumber },
            data: {
                isBlacklisted,
                riskLevel: isBlacklisted ? 'CRITICAL' : 'HIGH' // Escalate if blacklisted
            }
        });

        res.json(vehicle);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update blacklist status' });
    }
});

export default router;
