import { Router, Response } from 'express';
import prisma from '../prisma';
import { authenticateToken, AuthRequest, requireRole } from '../middleware/auth';

const router = Router();

const getParamValue = (value: string | string[] | undefined): string => {
    if (Array.isArray(value)) {
        return value[0] || '';
    }
    return value || '';
};

// GET /api/vehicles/blacklist - Get all blacklisted/watchlisted vehicles
router.get('/blacklist', authenticateToken, async (req: AuthRequest, res: Response): Promise<any> => {
    try {
        const vehicles = await (prisma as any).vehicle.findMany({
            where: {
                OR: [
                    { isBlacklisted: true },
                    { isWatchlisted: true }
                ]
            },
            orderBy: { updatedAt: 'desc' }
        });
        res.json(vehicles);
    } catch (error) {
        console.error('Error fetching watchlist:', error);
        res.status(500).json({ error: 'Failed to fetch flagged vehicles' });
    }
});

// GET /api/vehicles/:plateNumber/profile - Get full vehicle intelligence profile
router.get('/:plateNumber/profile', authenticateToken, async (req: AuthRequest, res: Response): Promise<any> => {
    try {
        const plateNumber = getParamValue(req.params.plateNumber);

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
                location: null, // Video uploads usually don't have lat/lng unless metadata is parsed.
                fineAmount: v.fineAmount || 0,
                confidenceScore: v.confidenceScore,
                cameraId: 'UPLOAD',
                cameraName: 'VIDEO_UPLOAD',
                videoId: v.videoId,
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
        const weeksDiff = Math.max(
            1,
            Math.ceil((new Date(lastSeen).getTime() - new Date(firstSeen).getTime()) / (1000 * 60 * 60 * 24 * 7))
        );
        const avgViolationsPerWeek = (allViolations.length / weeksDiff).toFixed(2);

        // Highest fine
        const highestFineViolation = allViolations.length > 0
            ? allViolations.reduce((prev, curr) => (prev.fineAmount > curr.fineAmount ? prev : curr))
            : null;

        res.json({
            summary: {
                plateNumber: vehicle.plateNumber,
                totalViolations: vehicle.totalViolations,
                riskLevel: vehicle.riskLevel,
                isBlacklisted: vehicle.isBlacklisted,
                isWatchlisted: vehicle.isWatchlisted,
                blacklistReason: vehicle.blacklistReason,
                blacklistedAt: vehicle.blacklistedAt,
                blacklistedBy: vehicle.blacklistedBy,
                totalFines,
                firstSeen,
                lastSeen,
                lastCameraId
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

// POST /api/vehicles/:plateNumber/blacklist - Add vehicle to blacklist
router.post('/:plateNumber/blacklist', authenticateToken, requireRole(['ADMIN', 'OFFICER']), async (req: AuthRequest, res: Response): Promise<any> => {
    try {
        const plateNumber = getParamValue(req.params.plateNumber);
        const { reason } = req.body;

        const vehicle = await (prisma as any).vehicle.upsert({
            where: { plateNumber },
            update: {
                isBlacklisted: true,
                blacklistReason: reason,
                blacklistedAt: new Date(),
                blacklistedBy: req.user?.id || 'SYSTEM',
                riskLevel: 'CRITICAL'
            },
            create: {
                plateNumber,
                isBlacklisted: true,
                blacklistReason: reason,
                blacklistedAt: new Date(),
                blacklistedBy: req.user?.id || 'SYSTEM',
                riskLevel: 'CRITICAL'
            }
        });

        await prisma.auditLog.create({
            data: {
                userId: req.user!.id,
                action: 'BLACKLIST_VEHICLE',
                entity: 'Vehicle',
                entityId: plateNumber,
                details: reason || null
            }
        }).catch(() => undefined);

        res.json(vehicle);
    } catch (error) {
        console.error('Error blacklisting vehicle:', error);
        res.status(500).json({ error: 'Failed to blacklist vehicle' });
    }
});

// DELETE /api/vehicles/:plateNumber/blacklist - Remove vehicle from blacklist
router.delete('/:plateNumber/blacklist', authenticateToken, requireRole(['ADMIN', 'OFFICER']), async (req: AuthRequest, res: Response): Promise<any> => {
    try {
        const plateNumber = getParamValue(req.params.plateNumber);

        const vehicle = await (prisma as any).vehicle.update({
            where: { plateNumber },
            data: {
                isBlacklisted: false,
                isWatchlisted: false, // Clearing blacklist also clears watchlist.
                blacklistReason: null,
                blacklistedAt: null,
                blacklistedBy: null,
                riskLevel: 'HIGH' // Downgrade risk level instead of resetting completely.
            }
        });

        await prisma.auditLog.create({
            data: {
                userId: req.user!.id,
                action: 'UNBLACKLIST_VEHICLE',
                entity: 'Vehicle',
                entityId: plateNumber
            }
        }).catch(() => undefined);

        res.json(vehicle);
    } catch (error) {
        console.error('Error removing vehicle from blacklist:', error);
        res.status(500).json({ error: 'Failed to remove vehicle from blacklist' });
    }
});

// POST /api/vehicles/:plateNumber/watchlist - Add vehicle to watchlist
router.post('/:plateNumber/watchlist', authenticateToken, requireRole(['ADMIN', 'OFFICER']), async (req: AuthRequest, res: Response): Promise<any> => {
    try {
        const plateNumber = getParamValue(req.params.plateNumber);
        const { reason } = req.body;

        const vehicle = await (prisma as any).vehicle.upsert({
            where: { plateNumber },
            update: {
                isWatchlisted: true,
                blacklistReason: reason // Reuse reason field for simplicity.
            },
            create: {
                plateNumber,
                isWatchlisted: true,
                blacklistReason: reason
            }
        });

        await prisma.auditLog.create({
            data: {
                userId: req.user!.id,
                action: 'WATCHLIST_VEHICLE',
                entity: 'Vehicle',
                entityId: plateNumber,
                details: reason || null
            }
        }).catch(() => undefined);

        res.json(vehicle);
    } catch (error) {
        console.error('Error watchlisting vehicle:', error);
        res.status(500).json({ error: 'Failed to watchlist vehicle' });
    }
});

export default router;
