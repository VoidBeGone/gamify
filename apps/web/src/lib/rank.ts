/**
 * Rank helpers.
 *
 * The API does not return the next-rank threshold needed to draw an XP bar, so
 * we mirror the static rank-tier table from the seed (apps/api/src/seed.ts).
 * Both global ranks and pillar ranks use the same XP thresholds, just with
 * different rank-name sets — so a single ascending threshold list works for the
 * progress math.
 */
const RANK_XP_THRESHOLDS = [
  0, 150, 350, 500, 850, 1200, 1500, 2200, 2900, 3500, 5000, 6500, 7000, 9500,
  11500, 13000, 17000, 22000,
] as const;

export interface RankProgress {
  /** XP at the start of the current rank tier. */
  floor: number;
  /** XP required for the next tier (null if at max). */
  ceiling: number | null;
  /** 0..1 fill within the current tier. */
  fraction: number;
  /** XP remaining to the next tier (null if at max). */
  remaining: number | null;
}

/** Compute progress within the current rank tier for an XP total. */
export function rankProgress(xp: number): RankProgress {
  let floor: number = RANK_XP_THRESHOLDS[0];
  let ceiling: number | null = null;

  for (let i = 0; i < RANK_XP_THRESHOLDS.length; i++) {
    if (xp >= RANK_XP_THRESHOLDS[i]) {
      floor = RANK_XP_THRESHOLDS[i];
      ceiling = RANK_XP_THRESHOLDS[i + 1] ?? null;
    } else {
      break;
    }
  }

  if (ceiling === null) {
    return { floor, ceiling: null, fraction: 1, remaining: null };
  }

  const span = ceiling - floor;
  const fraction = span > 0 ? Math.min(1, Math.max(0, (xp - floor) / span)) : 1;
  return { floor, ceiling, fraction, remaining: Math.max(0, ceiling - xp) };
}

const ROMAN: Array<[number, string]> = [
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

export function toRoman(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return String(n);
  let out = "";
  let rem = Math.floor(n);
  for (const [value, symbol] of ROMAN) {
    while (rem >= value) {
      out += symbol;
      rem -= value;
    }
  }
  return out;
}

/** "Striver" + tier 2 -> "Striver II". */
export function formatRank(rankName: string, tier: number): string {
  return `${rankName} ${toRoman(tier)}`.trim();
}
