"use client";

import { motion } from "framer-motion";

// Maps raw bonus keys from the XP engine to display labels.
const BONUS_LABELS: Record<string, string> = {
  all_pillar_day: "ALL-PILLAR BONUS",
  daily_sweep: "DAILY SWEEP",
  comeback_bonus: "COMEBACK BONUS",
};

function bonusLabel(bonuses: string[]): string | null {
  for (const key of Object.keys(BONUS_LABELS)) {
    if (bonuses.includes(key)) return BONUS_LABELS[key]!;
  }
  const streak = bonuses.find((b) => b.startsWith("streak_bonus_"));
  if (streak) return "STREAK BONUS";
  return null;
}

interface XPGainFloatProps {
  amount: number;
  bonuses: string[];
  /** Viewport X anchor — float centres on this. */
  x: number;
  /** Viewport Y anchor — float rises from this. */
  y: number;
  onComplete: () => void;
}

/**
 * Fixed-position float that animates upward from (x, y) and fades out.
 * Rendered by CelebrationManager at the viewport coordinates of the
 * triggering element (typically the task checkbox).
 */
export function XPGainFloat({ amount, bonuses, x, y, onComplete }: XPGainFloatProps) {
  const label = bonusLabel(bonuses);

  return (
    <motion.div
      initial={{ opacity: 0, y: 0 }}
      animate={{ opacity: [0, 1, 1, 0], y: -64 }}
      transition={{ duration: 1.5, times: [0, 0.1, 0.65, 1], ease: "easeOut" }}
      onAnimationComplete={onComplete}
      style={{ left: x, top: y, transform: "translateX(-50%)" }}
      className="pointer-events-none fixed z-[200] flex flex-col items-center gap-0.5"
    >
      <span className="font-display text-xl font-bold text-accent drop-shadow-lg">
        +{amount} XP
      </span>
      {label && (
        <span className="text-[10px] font-semibold uppercase tracking-widest text-sidequest drop-shadow">
          {label}
        </span>
      )}
    </motion.div>
  );
}
