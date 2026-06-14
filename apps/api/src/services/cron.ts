import { Types } from 'mongoose';
import { Streak, User, XpEvent } from '../models';
import { daysAgo, startOfDay } from '../utils/dates';
import { runDebuffEngine } from './debuffEngine';
import { checkAchievements } from './achievementChecker';
import { detectNudge } from './patternDetector';

/**
 * The daily cron logic for a single user: refresh debuffs, update streaks,
 * re-check achievements, and recompute the dashboard nudge. Safe to run
 * repeatedly (idempotent for a given day) — also invoked on dashboard load.
 */
export async function runDailyCron(userId: Types.ObjectId) {
  const pillars = await runDebuffEngine(userId);
  const streaks_updated = await updateStreaksForUser(userId);
  const achievements = await checkAchievements(userId);
  const nudge = await detectNudge(userId);

  return {
    pillars_updated: pillars.length,
    streaks_updated,
    achievements_unlocked: achievements,
    nudge,
  };
}

/**
 * Run the full daily cron for every user in the database. Called by the
 * scheduled job at 04:01 AM and by POST /admin/run-cron.
 */
export async function runAllUsersCron() {
  const users = await User.find().lean();

  let pillars_updated = 0;
  let streaks_updated = 0;
  let achievements_unlocked = 0;

  for (const user of users) {
    const uid = user._id as Types.ObjectId;

    const pillars = await runDebuffEngine(uid);
    pillars_updated += pillars.length;

    const achievements = await checkAchievements(uid);
    achievements_unlocked += achievements.length;

    streaks_updated += await updateStreaksForUser(uid);

    await detectNudge(uid);
  }

  return {
    users_processed: users.length,
    pillars_updated,
    achievements_unlocked,
    streaks_updated,
  };
}

/**
 * Check xp_events from the previous calendar day and update all streak
 * documents for the user accordingly: increment if active, reset to 0 if not.
 * Running at 04:01 AM evaluates the day that just ended.
 */
async function updateStreaksForUser(userId: Types.ObjectId): Promise<number> {
  const yesterday = daysAgo(1);
  const dayStart = startOfDay(yesterday);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

  const hadActivity = !!(await XpEvent.exists({
    user_id: userId,
    created_at: { $gte: dayStart, $lte: dayEnd },
  }));

  const streaks = await Streak.find({ user_id: userId });
  let updated = 0;

  for (const streak of streaks) {
    if (hadActivity) {
      streak.current_streak += 1;
      if (streak.current_streak > streak.longest_streak) {
        streak.longest_streak = streak.current_streak;
      }
      streak.last_active_date = dayEnd;
      await streak.save();
      updated++;
    } else if (streak.current_streak > 0) {
      streak.current_streak = 0;
      await streak.save();
      updated++;
    }
  }

  return updated;
}
