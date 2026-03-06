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
            releaseDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
            patchNotes: {
                create: [
                    { title: 'Violation Evidence Viewer', description: 'Frame-accurate video playback with AI bounding box overlays for legal verification.', category: 'feature', severity: 'critical', component: 'frontend' },
                    { title: 'High-Res Temporal Ingestion', description: 'Sub-second timestamp extraction and precise frame capture during AI inference.', category: 'improvement', severity: 'high', component: 'AI' },
                    { title: 'Vehicle Intelligence Profile', description: 'Deep-dive behavioral dossiers including Recharts analytics and localized Leaflet maps.', category: 'feature', severity: 'high', component: 'frontend' },
                ]
            }
        }
    });

    // V1.4
    const v14 = await prisma.systemVersion.create({
        data: {
            versionNumber: 'v1.4.0',
            releaseName: 'Global Blacklist & Watchlist Registry',
            releaseType: 'major',
            releaseStatus: 'released',
            createdBy: 'SYSTEM AUTOMATION',
            releaseDate: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
            patchNotes: {
                create: [
                    { title: 'Enforcement Blacklist Management', description: 'Administrative registry for high-threat vehicles (stolen, habitual offenders). Watchlist integration for flagged plates.', category: 'feature', severity: 'high', component: 'backend' },
                    { title: 'Immediate Alarm Escalation', description: 'Automatic generation of CRITICAL and audio alerts upon detection of blacklisted vehicles.', category: 'feature', severity: 'critical', component: 'frontend' },
                    { title: 'Dossier Integration', description: 'Vehicle intelligence profiles now permanently record blacklist status, rationale, and issuing authority.', category: 'improvement', severity: 'medium', component: 'frontend' },
                ]
            }
        }
    });

    // V1.5
    const v15 = await prisma.systemVersion.create({
        data: {
            versionNumber: 'v1.5.0',
            releaseName: 'Real-Time Intelligence & Metrics Engine',
            releaseType: 'major',
            releaseStatus: 'released',
            createdBy: 'SYSTEM AUTOMATION',
            releaseDate: new Date(),
            patchNotes: {
                create: [
                    { title: 'Live Dashboard Counters', description: 'Real-time aggregation of today\'s violations, hourly trends, and financial metrics without page refresh.', category: 'feature', severity: 'high', component: 'frontend' },
                    { title: 'Automated Stat Resets (CRON)', description: 'Server-side scheduled tasks to verify data integrity and reset daily/hourly metrics at midnight.', category: 'improvement', severity: 'medium', component: 'backend' },
                    { title: 'Instant WebSocket Synchronization', description: 'Bidirectional state updates for system health and violation metrics via high-throughput Redis pub-sub.', category: 'feature', severity: 'high', component: 'backend' },
                ]
            }
        }
    });

    // V1.6
    const v16 = await prisma.systemVersion.create({
        data: {
            versionNumber: 'v1.6.0',
            releaseName: 'Tactical Command Center',
            releaseType: 'major',
            releaseStatus: 'released',
            createdBy: 'SYSTEM AUTOMATION',
            releaseDate: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
            patchNotes: {
                create: [
                    { title: 'Live HLS Camera Grid', description: 'Added low-latency camera HLS feed switching with tactical 2x2/3x3/4x4 matrix support.', category: 'feature', severity: 'high', component: 'frontend' },
                    { title: 'Evidence Snapshot Capture', description: 'Introduced on-demand forensic snapshot capture from active camera streams.', category: 'feature', severity: 'high', component: 'AI' },
                    { title: 'Live Camera Recovery Logic', description: 'Camera reader now auto-recovers from OFFLINE stream states and reattaches safely.', category: 'fix', severity: 'high', component: 'AI' },
                    { title: 'No-Plate Dedup Throttle', description: 'Reduced duplicate flood by throttling no-plate detections in dense scenes.', category: 'performance', severity: 'medium', component: 'AI' }
                ]
            }
        }
    });

    // V1.7
    const v17 = await prisma.systemVersion.create({
        data: {
            versionNumber: 'v1.7.0',
            releaseName: 'Operations UX + Status Intelligence',
            releaseType: 'major',
            releaseStatus: 'released',
            createdBy: 'SYSTEM AUTOMATION',
            releaseDate: new Date(), // now
            patchNotes: {
                create: [
                    { title: 'System Updates Timeline Page', description: 'Built a dedicated version timeline at /system-updates with categorized expandable patch notes.', category: 'feature', severity: 'high', component: 'frontend' },
                    { title: 'System Status Monitoring Panel', description: 'Introduced /system-status with service health cards, AI/runtime telemetry, queue metrics, and incident timeline.', category: 'feature', severity: 'critical', component: 'frontend' },
                    { title: 'Global Header Health Indicator', description: 'Added top-bar status indicators for System, AI, Cameras, and Database with hover diagnostics.', category: 'improvement', severity: 'high', component: 'frontend' },
                    { title: 'Camera Table Virtualization', description: 'Optimized camera monitoring table rendering for large camera networks.', category: 'performance', severity: 'medium', component: 'frontend' },
                    { title: 'Patch Notes Category Badges', description: 'Standardized FEATURE/IMPROVEMENT/FIX/SECURITY/PERFORMANCE visual taxonomy.', category: 'security', severity: 'medium', component: 'frontend' }
                ]
            }
        }
    });

    // Keep metadata synchronized with latest seeded version
    await prisma.systemMetadata.updateMany({
        data: {
            currentVersion: 'v1.7.0',
            lastUpdated: new Date(),
            buildNumber: 7
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
