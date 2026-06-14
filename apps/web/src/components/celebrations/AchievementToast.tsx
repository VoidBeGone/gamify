"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { Trophy } from "lucide-react";

interface AchievementToastProps {
  title: string;
  description?: string;
  xpReward?: number;
  onDismiss: () => void;
}

/**
 * Bottom-right toast for achievement unlocks. Gold accent. Auto-dismisses 4 s.
 */
export function AchievementToast({
  title,
  description,
  xpReward,
  onDismiss,
}: AchievementToastProps) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 48, scale: 0.92 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 48, scale: 0.92 }}
      transition={{ type: "spring", stiffness: 340, damping: 26 }}
      onClick={onDismiss}
      className="fixed bottom-6 right-4 z-[150] flex w-72 max-w-[calc(100vw-2rem)] cursor-pointer items-start gap-3 rounded-2xl border border-sidequest/30 bg-surface p-4 shadow-xl"
      style={{ boxShadow: "0 0 40px -8px #F59E0B40" }}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sidequest/15">
        <Trophy className="h-5 w-5 text-sidequest" strokeWidth={2} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-sidequest">
          Achievement Unlocked
        </p>
        <p className="mt-0.5 truncate text-sm font-semibold text-text-primary">
          {title}
        </p>
        {description && (
          <p className="mt-0.5 line-clamp-2 text-xs text-text-secondary">
            {description}
          </p>
        )}
        {xpReward != null && xpReward > 0 && (
          <p className="mt-1 text-xs font-semibold text-sidequest">
            +{xpReward} XP
          </p>
        )}
      </div>

      {/* Dismiss progress bar */}
      <motion.div
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: 4, ease: "linear" }}
        className="absolute bottom-0 left-0 h-0.5 w-full origin-left rounded-b-2xl bg-sidequest/40"
      />
    </motion.div>
  );
}
