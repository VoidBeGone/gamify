import { Router } from 'express';
import { asyncHandler, ok } from '../utils/response';
import { runAllUsersCron } from '../services/cron';
import { todayString, getWeekStart, getWeekEnd } from '../utils/dateHelpers';

const router = Router();

// POST /admin/run-cron — trigger the full daily cron immediately (protected by x-api-key)
router.post(
  '/run-cron',
  asyncHandler(async (_req, res) => {
    const result = await runAllUsersCron();
    return ok(res, result);
  })
);

// GET /admin/date-debug — verify server date/timezone computation
router.get(
  '/date-debug',
  asyncHandler(async (_req, res) => {
    return ok(res, {
      server_time: new Date().toISOString(),
      today_string: todayString(),
      week_start: getWeekStart(),
      week_end: getWeekEnd(),
      timezone_offset: new Date().getTimezoneOffset(),
    });
  })
);

export default router;
