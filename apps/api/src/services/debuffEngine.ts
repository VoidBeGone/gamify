import { Types } from 'mongoose';
import { Pillar, IPillar } from '../models';
import { getNow, daysBetween } from '../utils/dates';

export type NeglectStatus = 'healthy' | 'warning' | 'neglected' | 'critical';

interface DebuffRule {
  status: NeglectStatus;
  /** Multiplier this pillar imposes on the OTHER pillars' future gains. */
  multiplier: number;
}

/**
 * Map days-since-activity → debuff state.
 *   0–2 days  → healthy   (100%)
 *   3–4 days  → warning   (100%, dashboard flag only)
 *   5–6 days  → neglected (others earn 75%)
 *   7+ days   → critical  (others earn 50%)
 */
export function debuffForDays(days: number): DebuffRule {
  if (days >= 7) return { status: 'critical', multiplier: 0.5 };
  if (days >= 5) return { status: 'neglected', multiplier: 0.75 };
  if (days >= 3) return { status: 'warning', multiplier: 1.0 };
  return { status: 'healthy', multiplier: 1.0 };
}

/**
 * Recompute neglect_status and xp_multiplier for every pillar belonging to the
 * user based on days since last_activity_date. Persists changes. Returns the
 * updated pillars.
 */
export async function runDebuffEngine(userId: Types.ObjectId): Promise<IPillar[]> {
  const pillars = await Pillar.find({ user_id: userId });
  const now = getNow();

  for (const pillar of pillars) {
    // No activity ever recorded → treat as healthy (nothing earned/neglected yet)
    const days = pillar.last_activity_date
      ? daysBetween(pillar.last_activity_date, now)
      : 0;
    const rule = debuffForDays(days);
    if (pillar.neglect_status !== rule.status || pillar.xp_multiplier !== rule.multiplier) {
      pillar.neglect_status = rule.status;
      pillar.xp_multiplier = rule.multiplier;
      await pillar.save();
    }
  }

  return pillars;
}
