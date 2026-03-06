import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- NEON GUARDIAN SYSTEM UPDATE PUBLICATION ---');

    const admin = await prisma.user.findFirst({
        where: {
            OR: [{ role: 'ADMIN' }, { role: 'admin' }]
        }
    });

    if (!admin) {
        console.error('CRITICAL: Admin user not found. Publication aborted.');
        return;
    }

    const updates = [
        {
            version: 'v1.1.0',
            name: 'Enforcement Matrix',
            type: 'minor',
            notes: [
                { title: 'Repeat Offender Tracking', category: 'feature', desc: 'Automated tracking of license plates with dynamic risk level escalation.' },
                { title: 'Automated Fine Calculation', category: 'feature', desc: 'Dynamic levy determination based on offense severity and multipliers.' }
            ]
        },
        {
            version: 'v1.2.0',
            name: 'Sentinel Guard',
            type: 'minor',
            notes: [
                { title: 'Camera Health Monitoring', category: 'feature', desc: 'Real-time tracking of node uptime, latency, and FPS.' },
                { title: 'Critical Alert System', category: 'feature', desc: 'High-severity popup overrides for blacklisted vehicles.' }
            ]
        },
        {
            version: 'v1.3.0',
            name: 'Forensic Eye',
            type: 'minor',
            notes: [
                { title: 'Violation Evidence Viewer', category: 'feature', desc: 'High-precision frame-accurate video playback for legal audits.' },
                { title: 'Vehicle Intelligence Profile', category: 'feature', desc: 'Deep-dive behavioral dossiers with Recharts analytics.' }
            ]
        },
        {
            version: 'v1.4.0',
            name: 'Sector Security',
            type: 'patch',
            notes: [
                { title: 'Enforcement Blacklist', category: 'feature', desc: 'Global registry for flagging high-threat vehicles with auto-alerts.' }
            ]
        },
        {
            version: 'v1.5.0',
            name: 'Pulse Engine',
            type: 'minor',
            notes: [
                { title: 'Real-Time Metrics Engine', category: 'performance', desc: 'Instant dashboard counters with automated CRON resets.' }
            ]
        },
        {
            version: 'v1.6.0',
            name: 'Tactical Matrix',
            type: 'major',
            notes: [
                { title: 'HLS Live Monitoring', category: 'feature', desc: 'Low-latency HLS streams for production-grade surveillance.' },
                { title: 'Forensic Snapshots', category: 'feature', desc: 'Capture high-fidelity evidence frames from live feeds.' },
                { title: 'Tactical Grid Matrix', category: 'feature', desc: 'Modular 2x2, 3x3, and 4x4 monitoring surfaces.' },
                { title: 'Live Camera Recovery Logic', category: 'fix', desc: 'Stream reader now recovers OFFLINE camera nodes safely.' },
                { title: 'No-Plate Dedup Throttle', category: 'performance', desc: 'Reduced duplicate events for no-plate detections under dense traffic.' }
            ]
        },
        {
            version: 'v1.7.0',
            name: 'Operations UX + Status Intelligence',
            type: 'major',
            notes: [
                { title: 'System Updates Timeline Page', category: 'feature', desc: 'Dedicated /system-updates timeline with categorized, expandable patch notes.' },
                { title: 'System Status Monitoring Panel', category: 'feature', desc: 'New /system-status command panel with service health and incident timeline.' },
                { title: 'Global Header Health Indicator', category: 'improvement', desc: 'Persistent status chips for System, AI, Cameras, and Database.' },
                { title: 'Camera Table Virtualization', category: 'performance', desc: 'Viewport virtualization for large camera lists in status monitoring.' },
                { title: 'Patch Notes Category Badges', category: 'security', desc: 'Standardized visual taxonomy for feature/improvement/fix/security/performance updates.' }
            ]
        }
    ];

    for (const update of updates) {
        const existing = await prisma.systemVersion.findUnique({
            where: { versionNumber: update.version }
        });

        if (existing) {
            console.log(`Skipping ${update.version} (Already published)`);
            continue;
        }

        console.log(`Publishing ${update.version}: ${update.name}...`);

        const version = await prisma.systemVersion.create({
            data: {
                versionNumber: update.version,
                releaseName: update.name,
                releaseType: update.type,
                releaseStatus: 'released',
                releaseDate: new Date(),
                createdBy: admin.id
            }
        });

        await prisma.patchNote.createMany({
            data: update.notes.map(n => ({
                versionId: version.id,
                title: n.title,
                description: n.desc,
                category: n.category,
                severity: 'high',
                component: 'system'
            }))
        });
    }

    // Update global metadata
    await prisma.systemMetadata.updateMany({
        data: { currentVersion: 'v1.7.0', lastUpdated: new Date(), buildNumber: 7 }
    });

    console.log('--- PUBLICATION COMPLETE: SYSTEM VERSION V1.7.0 ---');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
