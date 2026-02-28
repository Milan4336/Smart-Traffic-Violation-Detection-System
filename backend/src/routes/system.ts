import { Router, Request, Response } from 'express';
import prisma from '../prisma';
import { authenticateToken, AuthRequest, requireClearance } from '../middleware/auth';
import { redisPublisher } from '../redis';

const router = Router();

// GET /api/system/version/latest
router.get('/version/latest', authenticateToken, async (req: Request, res: Response) => {
    try {
        const metadata = await prisma.systemMetadata.findFirst();
        res.json({
            currentVersion: metadata?.currentVersion || 'v1.0.0',
            lastUpdated: metadata?.lastUpdated,
            environment: metadata?.environment,
            buildNumber: metadata?.buildNumber
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch latest version' });
    }
});

// GET /api/system/history (Versions and their Patch Notes)
router.get('/history', authenticateToken, async (req: Request, res: Response) => {
    try {
        const versions = await prisma.systemVersion.findMany({
            orderBy: { createdAt: 'desc' },
            include: { patchNotes: true }
        });
        res.json(versions);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch version history' });
    }
});

// POST /api/system/version/create
router.post('/version/create', authenticateToken, requireClearance(4), async (req: AuthRequest, res: Response): Promise<any> => {
    try {
        const { version_number, release_name, release_type, release_status } = req.body;

        const version = await prisma.systemVersion.create({
            data: {
                versionNumber: version_number,
                releaseName: release_name,
                releaseType: release_type,
                releaseStatus: release_status,
                createdBy: req.user!.id,
                releaseDate: release_status === 'released' ? new Date() : null
            }
        });

        if (release_status === 'released') {
            const metadata = await prisma.systemMetadata.findFirst();
            if (metadata) {
                await prisma.systemMetadata.update({
                    where: { id: metadata.id },
                    data: {
                        currentVersion: version_number,
                        lastUpdated: new Date()
                    }
                });
            }

            // Auto-log to changelog
            await prisma.systemChangelog.create({
                data: {
                    versionId: version.id,
                    changeType: 'SYSTEM_UPGRADE',
                    affectedModule: 'CORE',
                    newValue: version_number,
                    changedBy: req.user!.id
                }
            });

            // WebSocket event
            await redisPublisher.publish('system:update_available', JSON.stringify(version));
        }

        res.status(201).json(version);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create version' });
    }
});

// POST /api/system/patch/add
router.post('/patch/add', authenticateToken, requireClearance(4), async (req: AuthRequest, res: Response): Promise<any> => {
    try {
        const { version_id, title, description, category, severity, component } = req.body;

        const patch = await prisma.patchNote.create({
            data: {
                versionId: version_id,
                title,
                description,
                category,
                severity,
                component
            }
        });

        res.status(201).json(patch);
    } catch (error) {
        res.status(500).json({ error: 'Failed to add patch note' });
    }
});

// GET /api/system/changelog
router.get('/changelog', authenticateToken, requireClearance(4), async (req: Request, res: Response) => {
    try {
        const logs = await prisma.systemChangelog.findMany({
            orderBy: { timestamp: 'desc' },
            take: 100
        });
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch changelog' });
    }
});

export default router;
