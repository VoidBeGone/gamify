import { Router } from 'express';
import { Types } from 'mongoose';
import { DailySchedule, Pillar, XpEvent } from '../models';
import { getUser } from '../utils/context';
import { asyncHandler, ok, fail, HttpError } from '../utils/response';
import { isSameDay, startOfToday, endOfToday } from '../utils/dates';
import { calculate } from '../services/xpEngine';

const router = Router();

// POST /challenges/complete/:date — complete a day's challenge, run XP engine
router.post(
  '/complete/:date',
  asyncHandler(async (req, res) => {
    const user = await getUser(req);
    const date = new Date(req.params.date as string);
    if (isNaN(date.getTime())) return fail(res, 'Invalid date');

    const schedule = await DailySchedule.findOne({
      user_id: user._id,
      week_start: { $lte: new Date() },
    }).sort({ week_start: -1 });
    if (!schedule) throw new HttpError(404, 'No schedule found');

    const day = schedule.days.find((d) => isSameDay(d.date, date));
    if (!day || !day.challenge) throw new HttpError(404, 'No challenge for that date');
    const challenge = day.challenge;

    // Guard against double completion for the day
    const already = await XpEvent.findOne({
      user_id: user._id,
      event_type: { $in: ['challenge_complete', 'surprise'] },
      description: `Completed challenge: ${challenge.title}`,
      created_at: { $gte: startOfToday(), $lte: endOfToday() },
    });
    if (already) return fail(res, 'Challenge already completed today', 409);

    // Resolve an optional pillar from the challenge's pillar name
    let pillarId: Types.ObjectId | undefined;
    if (challenge.pillar) {
      const pillar = await Pillar.findOne({ user_id: user._id, name: challenge.pillar });
      if (pillar) pillarId = pillar._id as Types.ObjectId;
    }

    const result = await calculate({
      userId: user._id as any,
      pillarId,
      eventType: challenge.is_surprise ? 'surprise' : 'challenge_complete',
      description: `Completed challenge: ${challenge.title}`,
      baseXp: challenge.xp,
    });

    return ok(res, { challenge, xp_result: result });
  })
);

export default router;
