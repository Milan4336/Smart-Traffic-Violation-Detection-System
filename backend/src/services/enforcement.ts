export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
import { updateMetric } from './metrics';
import { publishJson } from '../redis';

export const normalizeViolationType = (value?: string | null): string => {
    if (!value) return 'UNKNOWN';
    return value.toUpperCase().replace(/\s+/g, '_');
};

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
    const normalizedType = normalizeViolationType(violationType);

    // Fetch rule
    const rule = await prisma.violationFineRule.findUnique({
        where: { violationType: normalizedType }
    }) || await prisma.violationFineRule.findUnique({
        where: { violationType: violationType }
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
        if (!violation?.id) {
            return null;
        }

        const violationType = normalizeViolationType(violation.type || violation.violationType);
        let alertType: 'CRITICAL' | 'HIGH' | 'MEDIUM' | null = null;
        let alertReason: string | null = null;

        // 1. Critical Type Logic
        if (vehicle?.isBlacklisted) {
            alertType = 'CRITICAL';
            alertReason = 'BLACKLISTED_VEHICLE_DETECTED';
        }
        else if (
            violationType === 'WRONG_WAY' ||
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

            if (alertType === 'CRITICAL') {
                await updateMetric('critical_alerts', 1);
            }

            // Publish to Redis for WebSocket broadcast
            await publishJson('alert:new', {
                id: alert.id,
                violationId: violation.id,
                cameraId: alert.cameraId,
                plateNumber: alert.plateNumber,
                type: violationType,
                alertType: alert.alertType,
                reason: alertReason,
                timestamp: alert.createdAt
            });

            console.log(`[ALERT] Created ${alertType} alert for ${violation.plateNumber}`);
            return alert;
        }

        return null;
    } catch (error) {
        console.error("Failed to create alert:", error);
        return null;
    }
};
