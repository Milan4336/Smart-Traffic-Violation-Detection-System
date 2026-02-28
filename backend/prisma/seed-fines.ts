import { PrismaClient } from '@prisma/client';
import process from 'process';

const prisma = new PrismaClient();

async function main() {
    const rules = [
        { violationType: 'NO_HELMET', baseAmount: 500, repeatMultiplier: 1.5 },
        { violationType: 'RED_LIGHT', baseAmount: 1000, repeatMultiplier: 2.0 },
        { violationType: 'WRONG_WAY', baseAmount: 1500, repeatMultiplier: 2.5 },
        { violationType: 'TRIPLE_RIDING', baseAmount: 800, repeatMultiplier: 1.5 },
        { violationType: 'OVERSPEED', baseAmount: 1200, repeatMultiplier: 2.0 },
        { violationType: 'no_helmet', baseAmount: 500, repeatMultiplier: 1.5 }, // Case insensitive support
        { violationType: 'red_light', baseAmount: 1000, repeatMultiplier: 2.0 }
    ];

    console.log('Seeding fine rules...');

    for (const rule of rules) {
        await (prisma as any).violationFineRule.upsert({
            where: { violationType: rule.violationType },
            update: {
                baseAmount: rule.baseAmount,
                repeatMultiplier: rule.repeatMultiplier
            },
            create: rule
        });
    }

    console.log('Fine rules seeded successfully.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
