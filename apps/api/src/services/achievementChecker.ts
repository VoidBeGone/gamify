import { Types } from 'mongoose';
import {
  Achievement,
  IAchievement,
  MetricsLog,
  Pillar,
  Streak,
  User,
  XpEvent,
} from '../models';
import { recalcGlobalRank, recalcPillarRank } from './ranks';

export interface UnlockedAchievement {
  achievement_id: Types.ObjectId;
  title: string;
  xp_reward: number;
  pillar_id?: Types.ObjectId;
}

/**
 * Compute the user's current value for a given achievement trigger_metric from
 * the metrics log / streaks. Returns null when there is no data for it.
 */
async function currentMetricValue(
  userId: Types.ObjectId,
  metric: string
): Promise<number | null> {
  switch (metric) {
    case 'followers': {
      const latest = await MetricsLog.findOne({ user_id: userId, metric_type: 'followers' })
        .sort({ logged_at: -1 })
        .lean();
      return latest ? latest.value : null;
    }
    case 'video_views': {
      const top = await MetricsLog.findOne({ user_id: userId, metric_type: 'video_views' })
        .sort({ value: -1 })
        .lean();
      return top ? top.value : null;
    }
    case 'workouts_logged': {
      const count = await MetricsLog.countDocuments({
        user_id: userId,
        metric_type: 'workout',
      });
      return count > 0 ? count : null;
    }
    case 'run_distance_km': {
      const longest = await MetricsLog.findOne({ user_id: userId, metric_type: 'run' })
        .sort({ value: -1 })
        .lean();
      return longest ? longest.value : null;
    }
    case 'run_pace_seconds_per_km': {
      // pace stored as secondary_value (seconds/km); best run = lowest pace
      const fastest = await MetricsLog.findOne({
        user_id: userId,
        metric_type: 'run',
        secondary_value: { $ne: null },
      })
        .sort({ secondary_value: 1 })
        .lean();
      return fastest && fastest.secondary_value != null ? fastest.secondary_value : null;
    }
    case 'body_fat_pct_delta': {
      const logs = await MetricsLog.find({ user_id: userId, metric_type: 'body_fat' })
        .sort({ logged_at: 1 })
        .lean();
      if (logs.length < 1) return null;
      const first = logs[0].value;
      const latest = logs[logs.length - 1].value;
      return first - latest; // positive = body fat lost
    }
    case 'lean_mass_gained_lbs': {
      const logs = await MetricsLog.find({ user_id: userId, metric_type: 'lean_mass' })
        .sort({ logged_at: 1 })
        .lean();
      if (logs.length < 1) return null;
      return logs[logs.length - 1].value - logs[0].value;
    }
    case 'nutrition_streak': {
      const streak = await Streak.findOne({
        user_id: userId,
        streak_type: 'nutrition',
      }).lean();
      return streak ? streak.longest_streak : null;
    }
    case 'lift_weight_kg': {
      // any logged PR satisfies a lift_pr achievement (trigger_value 0)
      const count = await MetricsLog.countDocuments({
        user_id: userId,
        metric_type: 'lift_pr',
      });
      return count > 0 ? 1 : null;
    }
    case 'side_quest_count': {
      const count = await MetricsLog.countDocuments({
        user_id: userId,
        metric_type: 'sidequest',
      });
      return count > 0 ? count : null;
    }
    default:
      return null;
  }
}

function isCrossed(metric: string, current: number, threshold: number): boolean {
  // pace achievements are "under X" → lower is better
  if (metric === 'run_pace_seconds_per_km') return current <= threshold;
  return current >= threshold;
}

/**
 * Check all untriggered achievements for a user against the latest metrics.
 * Awards XP for any newly crossed thresholds (to pillar + global), records
 * xp_events, marks them triggered, and recalculates ranks.
 */
export async function checkAchievements(
  userId: Types.ObjectId
): Promise<UnlockedAchievement[]> {
  const pending = await Achievement.find({ user_id: userId, is_triggered: false });
  if (pending.length === 0) return [];

  // cache metric values so we don't recompute per achievement
  const cache = new Map<string, number | null>();
  const valueFor = async (metric: string): Promise<number | null> => {
    if (!cache.has(metric)) cache.set(metric, await currentMetricValue(userId, metric));
    return cache.get(metric) ?? null;
  };

  const unlocked: UnlockedAchievement[] = [];

  for (const ach of pending) {
    let current: number | null;

    if (ach.trigger_type === 'metric_count_total') {
      const count = await MetricsLog.countDocuments({
        user_id: userId,
        metric_type: ach.trigger_metric,
      });
      current = count > 0 ? count : null;
    } else if (ach.trigger_type === 'metric_count_window') {
      const windowDays = ach.trigger_window_days ?? 0;
      const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
      const count = await MetricsLog.countDocuments({
        user_id: userId,
        metric_type: ach.trigger_metric,
        logged_at: { $gte: since },
      });
      current = count > 0 ? count : null;
    } else {
      current = await valueFor(ach.trigger_metric);
    }

    if (current == null) continue;
    if (!isCrossed(ach.trigger_metric, current, ach.trigger_value)) continue;

    ach.is_triggered = true;
    ach.triggered_at = new Date();
    await ach.save();

    // Award the reward XP and queue for dashboard display
    const user = await User.findById(userId);
    if (user) {
      user.global_xp += ach.xp_reward;
      await recalcGlobalRank(user);
      user.pending_celebrations.push(ach._id as Types.ObjectId);
      await user.save();
    }
    if (ach.pillar_id) {
      const pillar = await Pillar.findById(ach.pillar_id);
      if (pillar) {
        pillar.xp += ach.xp_reward;
        await recalcPillarRank(pillar);
        await pillar.save();
      }
    }

    await XpEvent.create({
      user_id: userId,
      pillar_id: ach.pillar_id,
      event_type: 'achievement',
      description: `Achievement unlocked: ${ach.title}`,
      xp_awarded: ach.xp_reward,
      multiplier_applied: 1.0,
    });

    unlocked.push({
      achievement_id: ach._id as Types.ObjectId,
      title: ach.title,
      xp_reward: ach.xp_reward,
      pillar_id: ach.pillar_id,
    });
  }

  return unlocked;
}
