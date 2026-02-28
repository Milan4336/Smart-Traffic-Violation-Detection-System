import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Seeding system updates...");

    // Remove existing mock updates
    await prisma.patchNote.deleteMany({});
    await prisma.systemVersion.deleteMany({});

    // V1.0
    const v10 = await prisma.systemVersion.create({
        data: {
            versionNumber: 'v1.0.0',
            releaseName: 'Core Engine Initialization',
            releaseType: 'major',
            releaseStatus: 'released',
            createdBy: 'SYSTEM AUTOMATION',
            releaseDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
            patchNotes: {
                create: [
                    { title: 'AI Detection Engine', description: 'Initial integration of YOLO object detection for traffic violations.', category: 'feature', severity: 'high', component: 'AI' },
                    { title: 'Real-time WebSocket Comms', description: 'Socket.io powered live alerts and dashboard updates.', category: 'feature', severity: 'high', component: 'backend' },
                    { title: 'Core Dashboards', description: 'Implementation of the primary analytical grid and live alert feeds.', category: 'feature', severity: 'medium', component: 'frontend' }
                ]
            }
        }
    });

    // V1.1
    const v11 = await prisma.systemVersion.create({
        data: {
            versionNumber: 'v1.1.0',
            releaseName: 'Enforcement Intel Module',
            releaseType: 'minor',
            releaseStatus: 'released',
            createdBy: 'SYSTEM AUTOMATION',
            releaseDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
            patchNotes: {
                create: [
                    { title: 'Repeat Offender Detection', description: 'Automatic tracking of license plates to identify chronic violators via risk levels.', category: 'feature', severity: 'high', component: 'backend' },
                    { title: 'Automated Fine Calculation', description: 'Dynamic levy determination based on offense severity and repeat multipliers.', category: 'feature', severity: 'medium', component: 'database' },
                ]
            }
        }
    });

    // V1.2
    const v12 = await prisma.systemVersion.create({
        data: {
            versionNumber: 'v1.2.0',
            releaseName: 'Infrastructure & Threat Alerting',
            releaseType: 'minor',
            releaseStatus: 'released',
            createdBy: 'SYSTEM AUTOMATION',
            releaseDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
            patchNotes: {
                create: [
                    { title: 'Camera Health Heartbeats', description: 'Continuous tracking of node uptime, FPS, and latency with automated DEGRADED states.', category: 'feature', severity: 'high', component: 'camera' },
                    { title: 'Critical Alert Overrides', description: 'High-severity popups for Blacklisted vehicles and critical violations (e.g., Wrong Way).', category: 'feature', severity: 'critical', component: 'frontend' },
                ]
            }
        }
    });

    // V1.3
    const v13 = await prisma.systemVersion.create({
        data: {
            versionNumber: 'v1.3.0',
            releaseName: 'Forensics & Recon Upgrade',
            releaseType: 'major',
            releaseStatus: 'released',
            createdBy: 'SYSTEM AUTOMATION',
            releaseDate: new Date(), // Today
            patchNotes: {
                create: [
                    { title: 'Violation Evidence Viewer', description: 'Frame-accurate video playback with AI bounding box overlays for legal verification.', category: 'feature', severity: 'critical', component: 'frontend' },
                    { title: 'High-Res Temporal Ingestion', description: 'Sub-second timestamp extraction and precise frame capture during AI inference.', category: 'improvement', severity: 'high', component: 'AI' },
                    { title: 'Vehicle Intelligence Profile', description: 'Deep-dive behavioral dossiers including Recharts analytics and localized Leaflet maps.', category: 'feature', severity: 'high', component: 'frontend' },
                ]
            }
        }
    });

    console.log("System updates seeded successfully!");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
