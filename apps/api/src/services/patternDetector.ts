import { Types } from 'mongoose';
import {
  DailySchedule,
  MetricsLog,
  Pillar,
  Streak,
  User,
  XpEvent,
} from '../models';
import { PILLAR_NAMES } from '../utils/context';
import {
  getNow,
  daysBetween,
  daysAgo,
  endOfWeek,
  startOfToday,
  startOfWeek,
} from '../utils/dates';

const FOLLOWER_MILESTONES = [100, 500, 1000, 5000, 10000];
const MILESTONE_PROXIMITY = 50;
const SIDE_QUEST_QUIET_DAYS = 10;

/**
 * Inspect the last 7 days of activity, latest metrics, streaks and debuff
 * states, then return a single templated nudge line for the dashboard.
 * Persists the chosen line to user.nudge_message. No AI — pure templates.
 */
export async function detectNudge(userId: Types.ObjectId): Promise<string> {
  const [pillars, user] = await Promise.all([
    Pillar.find({ user_id: userId }),
    User.findById(userId),
  ]);

  const byName = new Map(pillars.map((p) => [p.name, p]));
  const sevenDaysAgo = daysAgo(7);

  // Activity counts + most recent activity per pillar over the last 7 days
  const recentEvents = await XpEvent.find({
    user_id: userId,
    pillar_id: { $ne: null } as any,
    created_at: { $gte: sevenDaysAgo },
  })
    .select('pillar_id created_at')
    .lean();

  const countByPillar = new Map<string, number>();
  for (const e of recentEvents) {
    if (!e.pillar_id) continue;
    const key = e.pillar_id.toString();
    countByPillar.set(key, (countByPillar.get(key) ?? 0) + 1);
  }

  const lastActivityByPillar = new Map<string, Date>();
  for (const p of pillars) {
    if (p.last_activity_date) lastActivityByPillar.set((p._id as Types.ObjectId).toString(), p.last_activity_date);
  }

  const now = getNow();
  let nudge = pickNudge();

  async function resolve(): Promise<string> {
    return nudge;
  }

  function pickNudge(): string {
    // --- Priority 1: critical / neglected pillars ---
    const struggling = pillars
      .filter((p) => p.neglect_status === 'critical' || p.neglect_status === 'neglected')
      .sort((a, b) => (a.neglect_status === 'critical' ? -1 : 1));
    if (struggling.length > 0) {
      const p = struggling[0];
      const days = p.last_activity_date ? daysBetween(p.last_activity_date, now) : 0;
      return `${p.name} is ${p.neglect_status} — ${days} days without activity. Log something to recover.`;
    }

    // --- Priority 2: a pillar entering warning state ---
    const warning = pillars.find((p) => p.neglect_status === 'warning');
    if (warning) {
      return `${warning.name} is entering warning state. Do something today.`;
    }

    return '';
  }

  // Priority 1 & 2 handled synchronously above; remaining checks need queries.
  if (nudge) {
    await persist();
    return nudge;
  }

  // --- Priority 3: approaching a follower milestone ---
  const followersLog = await MetricsLog.findOne({ user_id: userId, metric_type: 'followers' })
    .sort({ logged_at: -1 })
    .lean();
  if (followersLog) {
    const followers = followersLog.value;
    const nextMilestone = FOLLOWER_MILESTONES.find((m) => m > followers);
    if (nextMilestone && nextMilestone - followers <= MILESTONE_PROXIMITY) {
      nudge = `You're ${nextMilestone - followers} followers away from your ${nextMilestone.toLocaleString()} milestone.`;
      await persist();
      return nudge;
    }
  }

  // --- Priority 4: this week's running target off track ---
  const runningNudge = await checkRunningTarget(userId);
  if (runningNudge) {
    nudge = runningNudge;
    await persist();
    return nudge;
  }

  // --- Priority 5: imbalance (busy in fitness, quiet on content) ---
  const fitness = byName.get(PILLAR_NAMES.fitness);
  const content = byName.get(PILLAR_NAMES.content);
  if (fitness && content) {
    const workoutsThisWeek = await MetricsLog.countDocuments({
      user_id: userId,
      metric_type: 'workout',
      logged_at: { $gte: sevenDaysAgo },
    });
    const lastContent = lastActivityByPillar.get((content._id as Types.ObjectId).toString());
    if (workoutsThisWeek >= 4 && lastContent) {
      const daysSinceContent = daysBetween(lastContent, now);
      if (daysSinceContent >= 5) {
        nudge = `You've logged ${workoutsThisWeek} workouts this week. Your last reel was ${daysSinceContent} days ago.`;
        await persist();
        return nudge;
      }
    }
  }

  // --- Priority 6: side quests gone quiet ---
  const sideQuests = byName.get(PILLAR_NAMES.sideQuests);
  if (sideQuests) {
    const last = lastActivityByPillar.get((sideQuests._id as Types.ObjectId).toString());
    const daysQuiet = last ? daysBetween(last, now) : null;
    if (daysQuiet !== null && daysQuiet >= SIDE_QUEST_QUIET_DAYS) {
      nudge = `No side quest logged in ${daysQuiet} days. When did you last do something just for the story?`;
      await persist();
      return nudge;
    }
  }

  // --- Priority 7: celebrate an active streak ---
  const globalStreak = await Streak.findOne({ user_id: userId, streak_type: 'global' }).lean();
  if (globalStreak && globalStreak.current_streak >= 3) {
    nudge = `You're on a ${globalStreak.current_streak}-day streak. Keep it alive — log something today.`;
    await persist();
    return nudge;
  }

  // --- Default ---
  nudge = 'Pick one thing today and log it. Momentum beats motivation.';
  await persist();
  return resolve();

  async function persist(): Promise<void> {
    if (user) {
      user.nudge_message = nudge;
      await user.save();
    }
  }
}

/**
 * Compare distance run so far this week against this week's running target
 * (from the active daily schedule). Returns a nudge if behind, else null.
 */
async function checkRunningTarget(userId: Types.ObjectId): Promise<string | null> {
  const schedule = await DailySchedule.findOne({
    user_id: userId,
    week_start: { $lte: getNow() },
  })
    .sort({ week_start: -1 })
    .lean();
  if (!schedule) return null;

  const target = schedule.days
    .map((d) => d.running_target?.target_distance_km ?? 0)
    .reduce((a, b) => a + b, 0);
  if (target <= 0) return null;

  const runsThisWeek = await MetricsLog.find({
    user_id: userId,
    metric_type: 'run',
    logged_at: { $gte: startOfWeek(), $lte: endOfWeek() },
  }).lean();
  const done = runsThisWeek.reduce((sum, r) => sum + r.value, 0);
  const remaining = target - done;

  // Only nudge when there's a meaningful gap and it's past mid-week.
  const today = startOfToday();
  const isLaterInWeek = daysBetween(startOfWeek(), today) >= 3;
  if (remaining > 0.5 && isLaterInWeek) {
    return `You're behind on this week's running target. ${remaining.toFixed(1)}km to go before Sunday.`;
  }
  return null;
}
