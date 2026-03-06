import bcrypt from 'bcrypt';
import prisma from './prisma';
import { normalizeViolationType } from './services/enforcement';

const DEFAULT_ADMIN_EMAIL = process.env.DEFAULT_ADMIN_EMAIL || 'admin@neonguardian.com';
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';
const DEFAULT_ADMIN_NAME = process.env.DEFAULT_ADMIN_NAME || 'Super Admin';

const DEFAULT_FINE_RULES = [
    { violationType: 'NO_HELMET', baseAmount: 500, repeatMultiplier: 1.5 },
    { violationType: 'RED_LIGHT', baseAmount: 1000, repeatMultiplier: 2.0 },
    { violationType: 'WRONG_WAY', baseAmount: 1500, repeatMultiplier: 2.5 },
    { violationType: 'TRIPLE_RIDING', baseAmount: 800, repeatMultiplier: 1.5 },
    { violationType: 'OVERSPEED', baseAmount: 1200, repeatMultiplier: 2.0 }
];

export const ensureBootstrapData = async (): Promise<void> => {
    // Ensure at least one admin account exists.
    let adminUser = await prisma.user.findUnique({ where: { email: DEFAULT_ADMIN_EMAIL } });
    if (!adminUser) {
        const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
        adminUser = await prisma.user.create({
            data: {
                name: DEFAULT_ADMIN_NAME,
                email: DEFAULT_ADMIN_EMAIL,
                passwordHash,
                role: 'ADMIN',
                clearanceLevel: 4
            }
        });
        console.log(`[Bootstrap] Created default admin user: ${DEFAULT_ADMIN_EMAIL}`);
    }

    // Ensure system metadata exists for updates/version panel.
    const metadata = await prisma.systemMetadata.findFirst();
    if (!metadata) {
        await prisma.systemMetadata.create({
            data: {
                currentVersion: 'v1.0.0',
                environment: process.env.NODE_ENV || 'production',
                buildNumber: 1
            }
        });
        console.log('[Bootstrap] Created default system metadata');
    }

    // Ensure at least one baseline version exists.
    const versionCount = await prisma.systemVersion.count();
    if (versionCount === 0) {
        await prisma.systemVersion.create({
            data: {
                versionNumber: 'v1.0.0',
                releaseName: 'Genesis Protocol',
                releaseType: 'major',
                releaseStatus: 'released',
                releaseDate: new Date(),
                createdBy: adminUser.id
            }
        });
        console.log('[Bootstrap] Created default system version v1.0.0');
    }

    // Ensure fine calculation rules exist.
    for (const rule of DEFAULT_FINE_RULES) {
        const normalizedType = normalizeViolationType(rule.violationType);
        await prisma.violationFineRule.upsert({
            where: { violationType: normalizedType },
            update: {
                baseAmount: rule.baseAmount,
                repeatMultiplier: rule.repeatMultiplier
            },
            create: {
                violationType: normalizedType,
                baseAmount: rule.baseAmount,
                repeatMultiplier: rule.repeatMultiplier
            }
        });
    }
};
