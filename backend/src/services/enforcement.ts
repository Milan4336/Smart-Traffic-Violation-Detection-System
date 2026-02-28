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

/**
 * Logic to automatically generate alerts based on violation severity/risk
 */
export const createAlertIfNeeded = async (prisma: any, violation: any, vehicle: any): Promise<any> => {
    try {
        let alertType: 'CRITICAL' | 'HIGH' | 'MEDIUM' | null = null;

        // 1. Critical Type Logic
        if (
            violation.type === 'WRONG_WAY' ||
            vehicle?.isBlacklisted ||
            vehicle?.riskLevel === 'CRITICAL'
        ) {
            alertType = 'CRITICAL';
        }
        // 2. High Priority Logic
        else if (
            (violation.confidenceScore >= 95) &&
            (vehicle?.riskLevel === 'HIGH' || vehicle?.riskLevel === 'MEDIUM')
        ) {
            alertType = 'HIGH';
        }
        // 3. Medium Priority Logic
        else if (vehicle?.totalViolations >= 5) {
            alertType = 'MEDIUM';
        }

        if (alertType) {
            const alert = await prisma.alert.create({
                data: {
                    violationId: violation.id,
                    cameraId: violation.cameraId,
                    plateNumber: violation.plateNumber,
                    alertType,
                    status: 'ACTIVE'
                }
            });

            // Publish to Redis for WebSocket broadcast
            const { redisPublisher } = require('../redis');
            if (redisPublisher) {
                await redisPublisher.publish('alert:new', JSON.stringify({
                    id: alert.id,
                    violationId: violation.id,
                    cameraId: alert.cameraId,
                    plateNumber: alert.plateNumber,
                    type: violation.type,
                    alertType: alert.alertType,
                    timestamp: alert.createdAt
                }));
            }

            console.log(`[ALERT] Created ${alertType} alert for ${violation.plateNumber}`);
            return alert;
        }

        return null;
    } catch (error) {
        console.error("Failed to create alert:", error);
        return null;
    }
};
