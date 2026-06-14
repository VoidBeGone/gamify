import { Types } from 'mongoose';
import {
  Goal,
  Pillar,
  Settings,
  Streak,
  User,
  XpEvent,
  XpEventType,
} from '../models';
import { endOfToday, startOfToday } from '../utils/dates';
import { recalcGlobalRank, recalcPillarRank, RankUp } from './ranks';
import { checkAchievements, UnlockedAchievement } from './achievementChecker';

export interface XpEngineInput {
  userId: Types.ObjectId;
  pillarId?: Types.ObjectId;
  eventType: XpEventType;
  description: string;
  baseXp: number;
}

export interface XpResult {
  xp_awarded: number;
  bonuses_triggered: string[];
  rank_up: { pillar?: RankUp; global?: RankUp } | null;
  achievement_unlocked: UnlockedAchievement[];
}

const STREAK_BONUS_PER_DAY = 0.1;
const STREAK_BONUS_CAP = 1.0;

/** Has a bonus with this description already been awarded today? */
async function bonusAwardedToday(
  userId: Types.ObjectId,
  description: string
): Promise<boolean> {
  const existing = await XpEvent.findOne({
    user_id: userId,
    description,
    created_at: { $gte: startOfToday(), $lte: endOfToday() },
  }).lean();
  return !!existing;
}

/**
 * The XP Calculation Engine. Applies debuffs, streak multipliers and bonus
 * mechanics for a single completion event, awards XP to the pillar and global
 * totals, advances ranks, records xp_events, and refreshes the pillar's
 * activity/debuff state.
 */
export async function calculate(input: XpEngineInput): Promise<XpResult> {
  const { userId, pillarId, eventType, description, baseXp } = input;

  // 1. Load settings (kept for completeness / future per-action overrides)
  await Settings.findOne({ user_id: userId });

  const bonuses: string[] = [];

  // 2. Lowest active debuff multiplier across all the user's pillars
  const pillars = await Pillar.find({ user_id: userId });
  const debuffMultiplier = pillars.reduce(
    (lowest, p) => Math.min(lowest, p.xp_multiplier ?? 1.0),
    1.0
  );

  // 3. Active global streak → +10%/day, capped at +100%
  const globalStreak = await Streak.findOne({ user_id: userId, streak_type: 'global' });
  const streakDays = globalStreak?.current_streak ?? 0;
  const streakBonus = Math.min(streakDays * STREAK_BONUS_PER_DAY, STREAK_BONUS_CAP);
  const streakMultiplier = 1 + streakBonus;

  // 4. Apply multipliers
  const totalMultiplier = debuffMultiplier * streakMultiplier;
  const actionXp = Math.round(baseXp * totalMultiplier);
  if (debuffMultiplier < 1) bonuses.push(`debuff_applied_${debuffMultiplier}`);
  if (streakBonus > 0) bonuses.push(`streak_bonus_${Math.round(streakBonus * 100)}pct`);

  // Resolve the active pillar (and capture its prior neglect state for comeback)
  const activePillar = pillarId
    ? pillars.find((p) => (p._id as Types.ObjectId).equals(pillarId)) ??
      (await Pillar.findById(pillarId))
    : null;
  const priorNeglect = activePillar?.neglect_status;

  // Bonus XP totals (awarded globally, not tied to the action pillar)
  let bonusXp = 0;
  const bonusEvents: { description: string; xp: number }[] = [];
  const settingsDoc = await Settings.findOne({ user_id: userId });
  const bonusConfig = settingsDoc?.bonus_config;

  // 5. Daily Sweep — every task scheduled for today is now complete
  if (bonusConfig && !(await bonusAwardedToday(userId, 'Bonus: Daily Sweep'))) {
    const todaysTasks = await collectTodaysTasks(userId);
    if (todaysTasks.length > 0 && todaysTasks.every((t) => t.is_completed)) {
      bonusXp += bonusConfig.daily_sweep;
      bonusEvents.push({ description: 'Bonus: Daily Sweep', xp: bonusConfig.daily_sweep });
      bonuses.push('daily_sweep');
    }
  }

  // 6. All-Pillar Day — activity logged in all 3 pillars today (incl. this one)
  if (bonusConfig && !(await bonusAwardedToday(userId, 'Bonus: All-Pillar Day'))) {
    const pillarIdsToday = new Set<string>();
    const events = await XpEvent.find({
      user_id: userId,
      pillar_id: { $ne: null } as any,
      created_at: { $gte: startOfToday(), $lte: endOfToday() },
    })
      .select('pillar_id')
      .lean();
    for (const e of events) if (e.pillar_id) pillarIdsToday.add(e.pillar_id.toString());
    if (pillarId) pillarIdsToday.add(pillarId.toString());
    if (pillarIdsToday.size >= 3) {
      bonusXp += bonusConfig.all_pillar_day;
      bonusEvents.push({ description: 'Bonus: All-Pillar Day', xp: bonusConfig.all_pillar_day });
      bonuses.push('all_pillar_day');
    }
  }

  // 11(early). Comeback Bonus — first activity returning a pillar from neglect
  if (
    bonusConfig &&
    activePillar &&
    (priorNeglect === 'neglected' || priorNeglect === 'critical')
  ) {
    bonusXp += bonusConfig.comeback_bonus;
    bonusEvents.push({ description: 'Bonus: Comeback', xp: bonusConfig.comeback_bonus });
    bonuses.push('comeback_bonus');
  }

  const rankUp: { pillar?: RankUp; global?: RankUp } = {};

  // 7. Award XP to the pillar + recalculate pillar rank
  if (activePillar) {
    activePillar.xp += actionXp;
    const pUp = await recalcPillarRank(activePillar);
    if (pUp) rankUp.pillar = pUp;

    // 11. Refresh activity / clear debuff on the active pillar
    activePillar.last_activity_date = new Date();
    activePillar.neglect_status = 'healthy';
    activePillar.xp_multiplier = 1.0;
    await activePillar.save();
  }

  // 7/9. Recalculate global XP + global rank
  const user = await User.findById(userId);
  if (user) {
    user.global_xp += actionXp + bonusXp;
    const gUp = await recalcGlobalRank(user);
    if (gUp) rankUp.global = gUp;
    await user.save();
  }

  // 10. Write the primary action event
  await XpEvent.create({
    user_id: userId,
    pillar_id: pillarId,
    event_type: eventType,
    description,
    xp_awarded: actionXp,
    multiplier_applied: Number(totalMultiplier.toFixed(2)),
  });

  // 10. Write bonus events
  for (const b of bonusEvents) {
    await XpEvent.create({
      user_id: userId,
      event_type: 'combo_bonus',
      description: b.description,
      xp_awarded: b.xp,
      multiplier_applied: 1.0,
    });
  }

  // 6 (achievements). Check whether any thresholds were crossed
  const achievement_unlocked = await checkAchievements(userId);

  return {
    xp_awarded: actionXp + bonusXp,
    bonuses_triggered: bonuses,
    rank_up: Object.keys(rankUp).length > 0 ? rankUp : null,
    achievement_unlocked,
  };
}

/** Gather all goal tasks scheduled for today across the user's goals. */
async function collectTodaysTasks(
  userId: Types.ObjectId
): Promise<{ is_completed: boolean }[]> {
  const goals = await Goal.find({ user_id: userId }).lean();
  const start = startOfToday();
  const end = endOfToday();
  const tasks: { is_completed: boolean }[] = [];
  for (const goal of goals) {
    for (const sg of goal.subgoals ?? []) {
      for (const t of sg.tasks ?? []) {
        if (t.scheduled_date && t.scheduled_date >= start && t.scheduled_date <= end) {
          tasks.push({ is_completed: t.is_completed });
        }
      }
    }
  }
  return tasks;
}
