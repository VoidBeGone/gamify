import { Types } from 'mongoose';
import { RankDefinition, IPillar, IUser } from '../models';

export interface RankUp {
  from: { rank_name: string; tier: number };
  to: { rank_name: string; tier: number };
}

/**
 * Given a current XP total and the set of rank definitions for a track
 * (a pillar, or global when pillar_id is null), return the highest rank the
 * XP qualifies for. Returns null when no definition matches.
 */
async function highestQualifyingRank(
  pillarId: Types.ObjectId | null,
  xp: number
): Promise<{ rank_name: string; tier: number } | null> {
  const match = pillarId ? { pillar_id: pillarId } : { pillar_id: null };
  const def = await RankDefinition.findOne({ ...match, xp_required: { $lte: xp } })
    .sort({ xp_required: -1, display_order: -1 })
    .lean();
  if (!def) return null;
  return { rank_name: def.rank_name, tier: def.tier };
}

/**
 * Recalculate a pillar's rank from its current XP. Mutates the pillar in place
 * (does not save). Returns a RankUp if the rank or tier advanced.
 */
export async function recalcPillarRank(pillar: IPillar): Promise<RankUp | null> {
  const target = await highestQualifyingRank(pillar._id as Types.ObjectId, pillar.xp);
  if (!target) return null;
  const advanced =
    target.rank_name !== pillar.rank_name || target.tier !== pillar.rank_tier;
  if (!advanced) return null;
  const from = { rank_name: pillar.rank_name, tier: pillar.rank_tier };
  pillar.rank_name = target.rank_name;
  pillar.rank_tier = target.tier;
  return { from, to: target };
}

/**
 * Recalculate the user's global rank from global_xp. Mutates in place.
 * Returns a RankUp if advanced.
 */
export async function recalcGlobalRank(user: IUser): Promise<RankUp | null> {
  const target = await highestQualifyingRank(null, user.global_xp);
  if (!target) return null;
  const advanced =
    target.rank_name !== user.global_rank_name || target.tier !== user.global_rank_tier;
  if (!advanced) return null;
  const from = { rank_name: user.global_rank_name, tier: user.global_rank_tier };
  user.global_rank_name = target.rank_name;
  user.global_rank_tier = target.tier;
  return { from, to: target };
}
