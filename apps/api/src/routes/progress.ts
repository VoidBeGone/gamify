import { Router } from 'express';
import { Types } from 'mongoose';
import { Goal, Pillar, Streak, User, XpEvent } from '../models';
import { getUser } from '../utils/context';
import { asyncHandler, ok } from '../utils/response';
import { startOfDay, daysAgo } from '../utils/dates';

const router = Router();

// GET /progress/global — full lifetime progress across all pillars
router.get(
  '/global',
  asyncHandler(async (req, res) => {
    const user = await getUser(req);
    const userId = user._id as Types.ObjectId;

    const [pillars, goals, streaks, xpEvents] = await Promise.all([
      Pillar.find({ user_id: userId }).lean(),
      Goal.find({ user_id: userId }).lean(),
      Streak.find({ user_id: userId }).lean(),
      XpEvent.find({ user_id: userId }).lean(),
    ]);

    // Total XP and tasks all-time
    const total_xp_earned = xpEvents.reduce((sum, e) => sum + (e.xp_awarded ?? 0), 0);
    const taskEvents = xpEvents.filter((e) => e.event_type === 'task_complete');
    const total_tasks_completed = taskEvents.length;

    // XP history last 90 days grouped by date
    const ninetyDaysAgo = startOfDay(daysAgo(89));
    const recentEvents = xpEvents.filter(
      (e) => new Date(e.created_at).getTime() >= ninetyDaysAgo.getTime()
    );
    const xpByDate = new Map<string, number>();
    for (const e of recentEvents) {
      const key = new Date(e.created_at).toISOString().slice(0, 10);
      xpByDate.set(key, (xpByDate.get(key) ?? 0) + (e.xp_awarded ?? 0));
    }
    const xp_history = Array.from(xpByDate.entries())
      .map(([date, xp_earned]) => ({ date, xp_earned }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Milestones hit = achievements triggered (from XpEvents of type 'achievement')
    const milestones_hit = xpEvents.filter((e) => e.event_type === 'achievement').length;

    // Per-pillar data
    const pillarMap = new Map(pillars.map((p) => [p._id.toString(), p]));
    const per_pillar = pillars.map((pillar) => {
      const pillarIdStr = pillar._id.toString();
      const pillarGoals = goals.filter((g) => g.pillar_id.toString() === pillarIdStr);
      const pillarXpEvents = xpEvents.filter(
        (e) => e.pillar_id && e.pillar_id.toString() === pillarIdStr
      );
      const xp_earned = pillarXpEvents.reduce((sum, e) => sum + (e.xp_awarded ?? 0), 0);
      const tasks_completed = pillarXpEvents.filter((e) => e.event_type === 'task_complete').length;

      // Count all tasks in this pillar's goals
      let tasks_total = 0;
      for (const g of pillarGoals) {
        for (const sg of g.subgoals ?? []) {
          tasks_total += (sg.tasks ?? []).length;
        }
      }

      const goalsData = pillarGoals.map((g) => {
        const subgoals = g.subgoals ?? [];
        const subgoals_completed = subgoals.filter((sg) => sg.status === 'completed').length;
        let goal_tasks_completed = 0;
        let goal_tasks_total = 0;
        for (const sg of subgoals) {
          const tasks = sg.tasks ?? [];
          goal_tasks_total += tasks.length;
          goal_tasks_completed += tasks.filter((t) => t.is_completed).length;
        }
        return {
          title: g.title,
          deadline: g.deadline,
          status: g.status,
          tasks_completed: goal_tasks_completed,
          tasks_total: goal_tasks_total,
          subgoals_completed,
          subgoals_total: subgoals.length,
          subgoals: subgoals.map((sg) => ({
            _id: sg._id,
            title: sg.title,
            status: sg.status,
            completed_tasks: (sg.tasks ?? [])
              .filter((t) => t.is_completed)
              .map((t) => ({
                _id: t._id,
                title: t.title,
                completed_at: t.completed_at,
                base_xp: t.base_xp,
                difficulty: t.difficulty,
              }))
              .sort((a, b) => {
                const aTime = a.completed_at ? (a.completed_at as Date).getTime() : 0;
                const bTime = b.completed_at ? (b.completed_at as Date).getTime() : 0;
                return bTime - aTime;
              }),
          })),
        };
      });

      return {
        pillar_name: pillar.name,
        color: pillar.color,
        rank_name: pillar.rank_name,
        rank_tier: pillar.rank_tier,
        xp: pillar.xp,
        tasks_completed,
        tasks_total,
        xp_earned,
        goals: goalsData,
      };
    });

    // Streak records
    const current_streaks = streaks.map((s) => ({
      type: s.streak_type,
      current: s.current_streak,
      longest: s.longest_streak,
    }));

    let total_tasks_completed_alltime = 0;
    for (const g of goals) {
      for (const sg of g.subgoals ?? []) {
        total_tasks_completed_alltime += (sg.tasks ?? []).filter((t) => t.is_completed).length;
      }
    }

    return ok(res, {
      total_tasks_completed,
      total_xp_earned,
      total_tasks_completed_alltime,
      total_xp_alltime: total_xp_earned,
      per_pillar,
      xp_history,
      milestones_hit,
      current_streaks,
    });
  })
);

export default router;
