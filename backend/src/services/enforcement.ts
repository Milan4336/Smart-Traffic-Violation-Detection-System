export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export const calculateRiskLevel = (violationCount: number): RiskLevel => {
    if (violationCount >= 11) return 'CRITICAL';
    if (violationCount >= 6) return 'HIGH';
    if (violationCount >= 3) return 'MEDIUM';
    return 'LOW';
};

/**
 * Calculates the fine amount based on base rules and repeat offender status.
 */
export const calculateFine = async (prisma: any, violationType: string, vehicleCount: number) => {
    // Fetch rule
    const rule = await prisma.violationFineRule.findUnique({
        where: { violationType: violationType }
    }) || await prisma.violationFineRule.findUnique({
        where: { violationType: violationType.toUpperCase() }
    });

    if (!rule) return 0;

    let fine = rule.baseAmount;
    const multiplier = rule.repeatMultiplier || 1.0;

    if (vehicleCount >= 10) {
        fine = Math.floor(rule.baseAmount * multiplier * 1.5);
    } else if (vehicleCount >= 3) {
        fine = Math.floor(rule.baseAmount * multiplier);
    }

    return fine;
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
