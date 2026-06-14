import cron from 'node-cron';
import { runAllUsersCron } from './cron';

export function initScheduler(): void {
  // 04:01 AM every day — evaluates the previous day's activity
  cron.schedule('1 4 * * *', async () => {
    console.log('[cron] Daily job started');
    try {
      const result = await runAllUsersCron();
      console.log('[cron] Done:', JSON.stringify(result));
    } catch (err) {
      console.error('[cron] Error during daily job:', err);
    }
  });
  console.log('[cron] Scheduler initialised — daily job at 04:01 AM');
}
