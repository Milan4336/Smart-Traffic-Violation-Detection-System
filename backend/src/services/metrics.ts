import prisma from '../prisma';
import { publishJson } from '../redis';

const DEFAULT_METRICS = [
    'violations_today',
    'violations_hour',
    'active_cameras',
    'offline_cameras',
    'critical_alerts',
    'fines_today',
    'repeat_offenders_today'
] as const;

const NON_NEGATIVE_METRICS = new Set<string>(DEFAULT_METRICS);

const sanitizeMetricValue = (metricName: string, value: number): number => {
    if (Number.isNaN(value) || !Number.isFinite(value)) {
        return 0;
    }
    const normalized = Math.round(value);
    if (NON_NEGATIVE_METRICS.has(metricName)) {
        return Math.max(0, normalized);
    }
    return normalized;
};

export const setMetric = async (
    metricName: string,
    value: number,
    broadcast: boolean = true
): Promise<number> => {
    const safeValue = sanitizeMetricValue(metricName, value);
    const metric = await (prisma as any).systemMetric.upsert({
        where: { metricName },
        update: {
            metricValue: safeValue,
            lastUpdated: new Date()
        },
        create: {
            metricName,
            metricValue: safeValue,
            lastUpdated: new Date()
        }
    });

    if (broadcast) {
        await publishJson('metrics:update', { [metricName]: metric.metricValue });
    }

    return metric.metricValue;
};

/**
 * Increment or decrement a system metric by a given value.
 * If the metric doesn't exist, it is created with the new value.
 * 
 * @param metricName The unique string identifier for the metric (e.g., 'violations_today')
 * @param amount The value to add (positive) or subtract (negative). Defaults to 1.
 */
export const updateMetric = async (metricName: string, amount: number = 1): Promise<void> => {
    try {
        const metric = await (prisma as any).systemMetric.findUnique({
            where: { metricName }
        });
        const current = metric?.metricValue ?? 0;
        const nextValue = await setMetric(metricName, current + amount, false);

        // Broadcast the updated metric individually
        await publishJson('metrics:update', { [metricName]: nextValue });

        // Also broadcast the full state for components that might have just connected 
        // (Optional: We could just rely on the REST endpoint for initial load)
    } catch (error) {
        console.error(`[MetricsEngine] Error updating metric ${metricName}:`, error);
    }
};

/**
 * Retrieve all currently tracked system metrics as a key-value object.
 */
export const getAllMetrics = async (): Promise<Record<string, number>> => {
    try {
        const metrics = await (prisma as any).systemMetric.findMany();
        const result: Record<string, number> = {};
        metrics.forEach((m: any) => {
            result[m.metricName] = sanitizeMetricValue(m.metricName, m.metricValue);
        });

        // Ensure default properties exist even if database hasn't logged them yet
        DEFAULT_METRICS.forEach(d => {
            if (result[d] === undefined) result[d] = 0;
        });

        return result;
    } catch (error) {
        console.error('[MetricsEngine] Error fetching all metrics:', error);
        return {};
    }
};

/**
 * Reset a specific metric to zero.
 * Often called by cron jobs (e.g. wiping daily counts at midnight).
 */
export const resetMetric = async (metricName: string): Promise<void> => {
    try {
        await setMetric(metricName, 0);
    } catch (error) {
        console.error(`[MetricsEngine] Error resetting metric ${metricName}:`, error);
    }
};

/**
 * Rebuilds dashboard metrics from authoritative DB values.
 * Used on startup and periodically to recover from stale increments.
 */
export const synchronizeCoreMetrics = async (): Promise<Record<string, number>> => {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const [
        liveViolationsToday,
        videoViolationsToday,
        liveViolationsHour,
        videoViolationsHour,
        activeCameras,
        offlineCameras,
        criticalAlerts,
        liveFineAggregate,
        videoFineAggregate,
        repeatOffendersToday
    ] = await Promise.all([
        prisma.violation.count({ where: { createdAt: { gte: startOfDay } } }),
        prisma.videoViolation.count({ where: { createdAt: { gte: startOfDay } } }),
        prisma.violation.count({ where: { createdAt: { gte: oneHourAgo } } }),
        prisma.videoViolation.count({ where: { createdAt: { gte: oneHourAgo } } }),
        prisma.camera.count({ where: { status: 'ONLINE' } }),
        prisma.camera.count({ where: { status: 'OFFLINE' } }),
        prisma.alert.count({
            where: {
                alertType: 'CRITICAL',
                status: { in: ['ACTIVE', 'ACKNOWLEDGED'] }
            }
        }),
        prisma.violation.aggregate({
            _sum: { fineAmount: true },
            where: { createdAt: { gte: startOfDay } }
        }),
        prisma.videoViolation.aggregate({
            _sum: { fineAmount: true },
            where: { createdAt: { gte: startOfDay } }
        }),
        prisma.vehicle.count({
            where: {
                totalViolations: { gt: 1 },
                lastViolationAt: { gte: startOfDay }
            }
        })
    ]);

    const payload: Record<string, number> = {
        violations_today: liveViolationsToday + videoViolationsToday,
        violations_hour: liveViolationsHour + videoViolationsHour,
        active_cameras: activeCameras,
        offline_cameras: offlineCameras,
        critical_alerts: criticalAlerts,
        fines_today: (liveFineAggregate._sum.fineAmount || 0) + (videoFineAggregate._sum.fineAmount || 0),
        repeat_offenders_today: repeatOffendersToday
    };

    await Promise.all(
        Object.entries(payload).map(([metricName, metricValue]) => setMetric(metricName, metricValue, false))
    );

    await publishJson('metrics:update', payload);
    return payload;
};
