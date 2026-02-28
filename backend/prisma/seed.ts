import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding Database with Enterprise Structure...');

    // 1. Clear existing Data
    await prisma.patchNote.deleteMany();
    await prisma.systemChangelog.deleteMany();
    await prisma.systemVersion.deleteMany();
    await prisma.systemMetadata.deleteMany();
    await prisma.alert.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.violation.deleteMany();
    await prisma.camera.deleteMany();
    await prisma.user.deleteMany();

    // 2. Create Admin User
    const passwordHash = await bcrypt.hash('admin123', 10);
    const admin = await prisma.user.create({
        data: {
            name: 'Super Admin',
            email: 'admin@neonguardian.com',
            passwordHash,
            role: 'admin',
            clearanceLevel: 4,
        },
    });
    console.log(`Created admin user: ${admin.email}`);

    // 3. System Metadata & Initial Version
    const currentVersion = 'v1.0.0';
    await prisma.systemMetadata.create({
        data: {
            currentVersion,
            environment: 'production',
            buildNumber: 1
        }
    });

    const v1 = await prisma.systemVersion.create({
        data: {
            versionNumber: currentVersion,
            releaseName: 'Genesis Protocol',
            releaseType: 'major',
            releaseDate: new Date(),
            releaseStatus: 'released',
            createdBy: admin.id
        }
    });

    await prisma.patchNote.createMany({
        data: [
            {
                versionId: v1.id,
                title: 'Initial Enterprise Deployment',
                description: 'System transformed from static dashboard to production-ready matrix.',
                category: 'feature',
                severity: 'critical',
                component: 'backend'
            },
            {
                versionId: v1.id,
                title: 'RTSP AI Ingestion',
                description: 'Added support for OpenCV physical camera tracking.',
                category: 'feature',
                severity: 'high',
                component: 'AI'
            }
        ]
    });
    console.log(`Created Release ${currentVersion}`);

    // 4. Create Physical Cameras
    const cameras = [
        {
            name: 'Intersection 4B North',
            rtspUrl: 'test_video.mp4', // Local file for testing inference
            locationLat: 28.6139,
            locationLng: 77.2090,
            status: 'ONLINE',
            nodeHealth: 'HEALTHY'
        },
        {
            name: 'MGT Highway Checkpoint',
            rtspUrl: 'rtsp://username:password@192.168.1.10:554/stream',
            locationLat: 28.6120,
            locationLng: 77.2080,
            status: 'OFFLINE',
            nodeHealth: 'OFFLINE'
        }
    ];

    for (const cam of cameras) {
        const createdCam = await prisma.camera.create({ data: cam });
        console.log(`Created camera: ${createdCam.name}`);
    }

    console.log('Enterprise Database Seeding Complete.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
