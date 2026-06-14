import { Router } from 'express';
import { Types } from 'mongoose';
import { XpEvent } from '../models';
import { getUser } from '../utils/context';
import { asyncHandler, ok } from '../utils/response';
import { startOfDay, daysAgo } from '../utils/dates';

const router = Router();

// GET /xp/calendar?months=2 — daily XP data for the activity calendar
router.get(
  '/calendar',
  asyncHandler(async (req, res) => {
    const user = await getUser(req);
    const months = Math.max(1, Math.min(12, Number(req.query.months) || 3));
    const days = months * 30;
    const since = startOfDay(daysAgo(days - 1));

    const events = await XpEvent.find({
      user_id: user._id,
      created_at: { $gte: since },
    })
      .sort({ created_at: 1 })
      .lean();

    // Group by date
    const byDate = new Map<
      string,
      { date: string; xp_earned: number; events: Array<{ type: string; description: string; xp: number }> }
    >();

    for (const e of events) {
      const dateKey = new Date(e.created_at).toISOString().slice(0, 10);
      if (!byDate.has(dateKey)) {
        byDate.set(dateKey, { date: dateKey, xp_earned: 0, events: [] });
      }
      const day = byDate.get(dateKey)!;
      day.xp_earned += e.xp_awarded ?? 0;
      day.events.push({
        type: e.event_type,
        description: e.description,
        xp: e.xp_awarded ?? 0,
      });
    }

    const result = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
    return ok(res, result);
  })
);

export default router;
