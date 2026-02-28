import { Vehicle } from '@prisma/client';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export const calculateRiskLevel = (violationCount: number): RiskLevel => {
    if (violationCount >= 11) return 'CRITICAL';
    if (violationCount >= 6) return 'HIGH';
    if (violationCount >= 3) return 'MEDIUM';
    return 'LOW';
};

/**
 * Updates an existng vehicle's violation count and risk level, 
 * or creates a new one if it doesn't exist.
 */
export const updateOrCreateVehicle = async (prisma: any, plateNumber: string) => {
    if (!plateNumber) return null;

    // Find existing vehicle
    const vehicle = await prisma.vehicle.findUnique({
        where: { plateNumber }
    });

    if (vehicle) {
        const newCount = vehicle.totalViolations + 1;
        const newRisk = calculateRiskLevel(newCount);

        return await prisma.vehicle.update({
            where: { plateNumber },
            data: {
                totalViolations: newCount,
                riskLevel: newRisk,
                lastViolationAt: new Date()
            }
        });
    } else {
        // Create new vehicle record
        return await prisma.vehicle.create({
            data: {
                plateNumber,
                totalViolations: 1,
                riskLevel: 'LOW',
                lastViolationAt: new Date()
            }
        });
    }
};
