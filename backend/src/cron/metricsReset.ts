import cron from 'node-cron';
import { resetMetric } from '../services/metrics';

console.log('[CRON] Metrics Reset Schedules Initialized.');

// 1. Midnight Reset (Runs every day at 00:00:00)
cron.schedule('0 0 * * *', async () => {
    try {
        console.log('[CRON] Executing midnight metrics reset...');
        await resetMetric('violations_today');
        await resetMetric('fines_today');
        await resetMetric('repeat_offenders_today');
        console.log('[CRON] Midnight metrics reset complete.');
    } catch (error) {
        console.error('[CRON] Error during midnight reset:', error);
    }
});

// 2. Hourly Reset (Runs at minute 0 of every hour)
cron.schedule('0 * * * *', async () => {
    try {
        console.log('[CRON] Executing hourly metrics reset...');
        await resetMetric('violations_hour');
        console.log('[CRON] Hourly metrics reset complete.');
    } catch (error) {
        console.error('[CRON] Error during hourly reset:', error);
    }
});
