import { Router } from 'express';
import { Types } from 'mongoose';
import {
  Achievement,
  DailySchedule,
  Goal,
  MetricsLog,
  Pillar,
  Streak,
  XpEvent,
} from '../models';
import { getUser } from '../utils/context';
import { asyncHandler, ok } from '../utils/response';
import { startOfWeek, endOfWeek } from '../utils/dates';
import { detectNudge } from '../services/patternDetector';

const router = Router();

// GET /review/weekly?week_offset=N  (0 = current, -1 = last, -2 = two weeks ago, …)
router.get(
  '/weekly',
  asyncHandler(async (req, res) => {
    const user = await getUser(req);

    const weekOffset = parseInt(String(req.query.week_offset ?? '0'), 10) || 0;
    const ref = new Date();
    ref.setDate(ref.getDate() + weekOffset * 7);
    const weekStart = startOfWeek(ref);
    const weekEnd = endOfWeek(ref);

    const [pillars, xpEvents, goals, streak, achievements, runLogs, schedule] =
      await Promise.all([
        Pillar.find({ user_id: user._id }).lean(),
        XpEvent.find({
          user_id: user._id,
          created_at: { $gte: weekStart, $lte: weekEnd },
        }).lean(),
        Goal.find({ user_id: user._id }).lean(),
        Streak.findOne({ user_id: user._id, streak_type: 'global' }).lean(),
        Achievement.find({
          user_id: user._id,
          is_triggered: true,
          triggered_at: { $gte: weekStart, $lte: weekEnd },
        }).lean(),
        MetricsLog.find({
          user_id: user._id,
          metric_type: 'run',
          logged_at: { $gte: weekStart, $lte: weekEnd },
        }).lean(),
        DailySchedule.findOne({
          user_id: user._id,
          week_start: { $lte: weekEnd },
        })
          .sort({ week_start: -1 })
          .lean(),
      ]);

    const pillarName = new Map(pillars.map((p) => [p._id.toString(), p.name]));

    let xp_earned = 0;
    const xpByPillar: Record<string, number> = {};
    for (const e of xpEvents) {
      xp_earned += e.xp_awarded;
      const name = e.pillar_id
        ? (pillarName.get(e.pillar_id.toString()) ?? 'Other')
        : 'Bonus';
      xpByPillar[name] = (xpByPillar[name] ?? 0) + e.xp_awarded;
    }

    let tasks_scheduled = 0;
    let tasks_completed = 0;
    for (const goal of goals) {
      for (const sg of goal.subgoals ?? []) {
        for (const t of sg.tasks ?? []) {
          if (
            t.scheduled_date &&
            t.scheduled_date >= weekStart &&
            t.scheduled_date <= weekEnd
          ) {
            tasks_scheduled += 1;
          }
          if (
            t.completed_at &&
            t.completed_at >= weekStart &&
            t.completed_at <= weekEnd
          ) {
            tasks_completed += 1;
          }
        }
      }
    }

    const debuffs = pillars
      .filter((p) => p.neglect_status !== 'healthy')
      .map((p) => ({ pillar: p.name, status: p.neglect_status, xp_multiplier: p.xp_multiplier }));

    const nudge = user.nudge_message ?? (await detectNudge(user._id as Types.ObjectId));

    const running_actual_km = runLogs.reduce((sum, r) => sum + r.value, 0);
    const running_target_km = schedule
      ? schedule.days
          .filter((d) => d.running_target)
          .reduce((sum, d) => sum + (d.running_target?.target_distance_km ?? 0), 0)
      : null;

    return ok(res, {
      week_start: weekStart,
      week_end: weekEnd,
      xp_earned,
      xp_by_pillar: xpByPillar,
      tasks_completed,
      tasks_scheduled,
      streak: streak ?? null,
      achievements,
      debuffs,
      nudge,
      running_actual_km,
      running_target_km,
    });
  })
);

export default router;
