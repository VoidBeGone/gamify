"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";

interface StreakBannerProps {
  days: number;
  onDismiss: () => void;
}

const STREAK_LABELS: Record<number, string> = {
  7: "One Week",
  14: "Two Weeks",
  30: "30 Days",
  60: "60 Days",
  100: "100 Days",
};

/**
 * Streak-milestone banner. Slides down from the top for 3 seconds.
 * Only shown at 7, 14, 30, 60, 100-day milestones.
 */
export function StreakBanner({ days, onDismiss }: StreakBannerProps) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const label = STREAK_LABELS[days] ?? `${days} Days`;

  return (
    <motion.div
      initial={{ y: "-100%", opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: "-100%", opacity: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      onClick={onDismiss}
      className="fixed inset-x-0 top-0 z-[150] flex cursor-pointer items-center justify-center gap-2.5 px-4 py-3.5 shadow-xl"
      style={{
        backgroundColor: "rgba(234,179,8,0.12)",
        borderBottom: "1px solid rgba(234,179,8,0.35)",
        backdropFilter: "blur(12px)",
      }}
    >
      <span className="text-xl leading-none">🔥</span>
      <p className="font-display text-base font-semibold text-text-primary">
        <span className="text-debuff-warning">{label} Streak</span>
        <span className="ml-2 text-sm font-normal text-text-secondary">
          {days} days and counting
        </span>
      </p>
    </motion.div>
  );
}
