import { Router } from 'express';
import { Types } from 'mongoose';
import { DailySchedule } from '../models';
import { getUser } from '../utils/context';
import { asyncHandler, ok, fail, HttpError } from '../utils/response';
import { getNow, startOfWeek } from '../utils/dates';
import { toDateString, todayString, getWeekStart } from '../utils/dateHelpers';

const router = Router();

/** Find the schedule whose week window contains `now`. */
async function findCurrentSchedule(userId: Types.ObjectId) {
  return DailySchedule.findOne({
    user_id: userId,
    week_start: { $lte: getNow() },
  }).sort({ week_start: -1 });
}

// GET /schedule/today — today's tasks + challenge + running target
router.get(
  '/today',
  asyncHandler(async (req, res) => {
    const user = await getUser(req);
    const schedule = await findCurrentSchedule(user._id as any);
    if (!schedule) return ok(res, null);

    const day = schedule.days.find((d) => toDateString(d.date) === todayString()) ?? null;
    return ok(res, {
      week_start: schedule.week_start,
      day,
    });
  })
);

// GET /schedule/week — full current week schedule
router.get(
  '/week',
  asyncHandler(async (req, res) => {
    const user = await getUser(req);
    const schedule = await findCurrentSchedule(user._id as any);
    return ok(res, schedule ?? null);
  })
);

// POST /schedule/week — write a new weekly schedule (used by MCP)
router.post(
  '/week',
  asyncHandler(async (req, res) => {
    const user = await getUser(req);
    const { week_start, generated_by, context_at_generation, days } = req.body ?? {};
    if (!week_start) return fail(res, 'week_start is required');
    if (!Array.isArray(days)) return fail(res, 'days must be an array');

    const currentWeekStart = getWeekStart();
    if (week_start !== currentWeekStart) {
      console.warn(
        `[schedule] MCP sent week_start="${week_start}" but current week is "${currentWeekStart}" — overriding`
      );
    }
    const weekStartDate = startOfWeek();

    const schedule = await DailySchedule.findOneAndUpdate(
      { user_id: user._id, week_start: weekStartDate },
      {
        $set: {
          user_id: user._id,
          week_start: weekStartDate,
          generated_at: new Date(),
          generated_by: generated_by ?? 'ai_session',
          context_at_generation: context_at_generation ?? {},
          days,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return ok(res, schedule, 201);
  })
);

// DELETE /schedule/task — remove a task from a day's schedule (does not delete the underlying goal task)
router.delete(
  '/task',
  asyncHandler(async (req, res) => {
    const user = await getUser(req);
    const { date, task_ref_id } = req.body ?? {};
    if (!date || !task_ref_id) {
      return fail(res, 'date and task_ref_id are required');
    }

    const schedule = await findCurrentSchedule(user._id as any);
    if (!schedule) throw new HttpError(404, 'No schedule found');

    const day = schedule.days.find((d) => toDateString(d.date) === toDateString(date));
    if (!day) throw new HttpError(404, 'No scheduled day for that date');

    const idx = day.tasks.findIndex((t) => t.task_ref_id.toString() === task_ref_id);
    if (idx === -1) throw new HttpError(404, 'Task not found in schedule');

    day.tasks.splice(idx, 1);
    await schedule.save();
    return ok(res, { removed_task_ref_id: task_ref_id, date });
  })
);

// PATCH /schedule/task — update a specific task in the schedule
router.patch(
  '/task',
  asyncHandler(async (req, res) => {
    const user = await getUser(req);
    const { date, task_ref_id, updates } = req.body ?? {};
    if (!date || !task_ref_id) {
      return fail(res, 'date and task_ref_id are required');
    }

    const schedule = await findCurrentSchedule(user._id as any);
    if (!schedule) throw new HttpError(404, 'No schedule found');

    const day = schedule.days.find((d) => toDateString(d.date) === toDateString(date));
    if (!day) throw new HttpError(404, 'No scheduled day for that date');

    const task = day.tasks.find((t) => t.task_ref_id.toString() === task_ref_id);
    if (!task) throw new HttpError(404, 'Task not found in schedule');

    const allowed = ['title', 'pillar', 'xp', 'is_featured'] as const;
    for (const key of allowed) {
      if (updates?.[key] !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (task as any)[key] = updates[key];
      }
    }
    await schedule.save();
    return ok(res, task);
  })
);

export default router;
