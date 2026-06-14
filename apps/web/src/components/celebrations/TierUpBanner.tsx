"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { ChevronsUp } from "lucide-react";
import { toRoman } from "@/lib/rank";

interface TierUpBannerProps {
  rankName: string;
  tier: number;
  color: string;
  onDismiss: () => void;
}

/**
 * Slides down from the top of the screen on a tier advance
 * (same rank name, next tier — e.g. Athlete I → Athlete II).
 * Auto-dismisses after 3 seconds.
 */
export function TierUpBanner({ rankName, tier, color, onDismiss }: TierUpBannerProps) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ y: "-100%", opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: "-100%", opacity: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      onClick={onDismiss}
      className="fixed inset-x-0 top-0 z-[150] flex cursor-pointer items-center justify-center gap-3 px-4 py-3.5 shadow-xl"
      style={{
        backgroundColor: `${color}15`,
        borderBottom: `1px solid ${color}40`,
        backdropFilter: "blur(12px)",
      }}
    >
      <ChevronsUp
        className="h-5 w-5 shrink-0"
        style={{ color }}
        strokeWidth={2.5}
      />
      <p
        className="font-display text-base font-semibold tracking-wide"
        style={{ color }}
      >
        RANK UP —{" "}
        <span className="text-text-primary">
          {rankName} {toRoman(tier)}
        </span>
      </p>
    </motion.div>
  );
}
