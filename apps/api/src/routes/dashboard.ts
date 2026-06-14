import { Router } from 'express';
import { Types } from 'mongoose';
import {
  Achievement,
  DailySchedule,
  Goal,
  MetricsLog,
  Pillar,
  Streak,
  User,
  WorkoutTemplate,
  XpEvent,
} from '../models';
import { getUser } from '../utils/context';
import { asyncHandler, ok } from '../utils/response';
import {
  getNow,
  startOfToday,
  endOfToday,
} from '../utils/dates';
import { toDateString, todayString } from '../utils/dateHelpers';
import { runDailyCron } from '../services/cron';

const router = Router();

const DAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

// GET /dashboard — aggregated dashboard view (also runs the daily cron logic)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = await getUser(req);
    const userId = user._id as Types.ObjectId;

    // Refresh debuffs, streaks, achievements and nudge on every dashboard load.
    const cron = await runDailyCron(userId);

    // Drain pending_celebrations — read then clear atomically so a double load
    // doesn't show the same celebration twice.
    const freshUser = await User.findById(userId);
    const celebrationIds = freshUser?.pending_celebrations ?? [];
    const pending_celebrations =
      celebrationIds.length > 0
        ? await Achievement.find({ _id: { $in: celebrationIds } })
            .select('title xp_reward pillar_id')
            .lean()
        : [];
    if (celebrationIds.length > 0) {
      await User.updateOne({ _id: userId }, { $set: { pending_celebrations: [] } });
    }

    const now = getNow();
    const [pillars, streaks, goals, template, schedule, bonusEvents] = await Promise.all([
      Pillar.find({ user_id: userId }).lean(),
      Streak.find({ user_id: userId }).lean(),
      Goal.find({ user_id: userId, status: 'active' }).lean(),
      WorkoutTemplate.findOne({ user_id: userId, is_active: true }).sort({ generated_at: -1 }).lean(),
      DailySchedule.findOne({ user_id: userId, week_start: { $lte: now } }).sort({ week_start: -1 }).lean(),
      XpEvent.find({
        user_id: userId,
        event_type: 'combo_bonus',
        created_at: { $gte: startOfToday(), $lte: endOfToday() },
      }).lean(),
    ]);

    // Today's tasks from goals (scheduled today)
    const start = startOfToday();
    const end = endOfToday();
    const today_tasks: unknown[] = [];
    const deadlines: { type: string; title: string; deadline: Date; goal_title: string }[] = [];
    for (const goal of goals) {
      if (goal.deadline) {
        deadlines.push({ type: 'goal', title: goal.title, deadline: goal.deadline, goal_title: goal.title });
      }
      for (const sg of goal.subgoals ?? []) {
        if (sg.deadline && sg.status !== 'completed') {
          deadlines.push({ type: 'subgoal', title: sg.title, deadline: sg.deadline, goal_title: goal.title });
        }
        for (const t of sg.tasks ?? []) {
          if (t.scheduled_date && toDateString(t.scheduled_date) === todayString()) {
            today_tasks.push({
              _id: t._id,
              title: t.title,
              difficulty: t.difficulty,
              base_xp: t.base_xp,
              is_completed: t.is_completed,
              goal_id: goal._id,
              goal_title: goal.title,
              subgoal_id: sg._id,
              pillar_id: goal.pillar_id,
            });
          }
        }
      }
    }

    deadlines.sort((a, b) => a.deadline.getTime() - b.deadline.getTime());

    // Today's challenge + running target from the schedule
    const scheduleDay = schedule
      ? schedule.days.find((d) => toDateString(d.date) === todayString()) ?? null
      : null;

    // Today's workout session
    let workout = null;
    if (template) {
      const todayName = DAY_NAMES[now.getDay()];
      const session =
        template.schedule.find((d) => d.day_name.toLowerCase() === todayName.toLowerCase()) ?? null;
      workout = { day_name: todayName, session, is_rest_day: session == null, program_name: template.program_name };
    }

    const debuffs = pillars
      .filter((p) => p.neglect_status !== 'healthy')
      .map((p) => ({
        pillar: p.name,
        status: p.neglect_status,
        xp_multiplier: p.xp_multiplier,
        explanation:
          p.neglect_status === 'warning'
            ? 'No activity in 3+ days — log something to avoid a penalty.'
            : `${p.name} is ${p.neglect_status}; other pillars earn at ${Math.round(p.xp_multiplier * 100)}% until you return.`,
      }));

    // Today's meal-level nutrition (same logic as GET /nutrition/today).
    const todaysMeals = await MetricsLog.find({
      user_id: userId,
      metric_type: 'meal_entry_protein',
      logged_at: { $gte: start, $lte: end },
    }).lean();
    const nutritionProtein = todaysMeals.reduce((sum, m) => sum + (m.value ?? 0), 0);
    const nutritionCalories = todaysMeals.reduce((sum, m) => sum + (m.secondary_value ?? 0), 0);
    const nutrition_today = {
      total_protein: nutritionProtein,
      total_calories: nutritionCalories,
      protein_target: 182,
      protein_remaining: 182 - nutritionProtein,
      meal_count: todaysMeals.length,
    };

    return ok(res, {
      user: {
        username: user.username,
        global_xp: user.global_xp,
        global_rank_name: user.global_rank_name,
        global_rank_tier: user.global_rank_tier,
      },
      streak: streaks.find((s) => s.streak_type === 'global') ?? null,
      streaks,
      today_tasks,
      workout,
      challenge: scheduleDay?.challenge ?? null,
      running_target: scheduleDay?.running_target ?? null,
      schedule_tasks: scheduleDay?.tasks ?? [],
      pillars,
      deadlines: deadlines.slice(0, 5),
      nudge: cron.nudge,
      debuffs,
      bonuses_today: bonusEvents.map((e) => ({ description: e.description, xp: e.xp_awarded })),
      nutrition_today,
      pending_celebrations,
    });
  })
);

export default router;
