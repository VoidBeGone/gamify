"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { formatRank } from "@/lib/rank";

interface RankUpOverlayProps {
  rankName: string;
  tier: number;
  color: string;
  isGlobal: boolean;
  onDismiss: () => void;
}

/**
 * Full-screen overlay for a rank *name* change — the big moment.
 * Auto-dismisses after 5 seconds or on tap.
 */
export function RankUpOverlay({
  rankName,
  tier,
  color,
  isGlobal,
  onDismiss,
}: RankUpOverlayProps) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      onClick={onDismiss}
      className="fixed inset-0 z-[160] flex cursor-pointer flex-col items-center justify-center px-8 text-center"
      style={{ backgroundColor: "rgba(0,0,0,0.88)", backdropFilter: "blur(8px)" }}
    >
      {/* Glow ring */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.15, type: "spring", stiffness: 200, damping: 18 }}
        className="mb-8 flex h-28 w-28 items-center justify-center rounded-full"
        style={{
          background: `radial-gradient(circle, ${color}30 0%, transparent 70%)`,
          boxShadow: `0 0 80px 0px ${color}60, 0 0 160px -20px ${color}40`,
        }}
      >
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.25, type: "spring", stiffness: 260, damping: 18 }}
          className="h-16 w-16 rounded-full"
          style={{
            background: `radial-gradient(circle at 35% 35%, ${color}80, ${color}30)`,
            boxShadow: `inset 0 0 20px ${color}60`,
          }}
        />
      </motion.div>

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mb-3 text-sm uppercase tracking-[0.35em] text-text-secondary"
      >
        {isGlobal ? "New Global Rank" : "New Rank"}
      </motion.p>

      <motion.h1
        initial={{ opacity: 0, y: 12, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.38, type: "spring", stiffness: 200, damping: 20 }}
        className="font-display text-5xl font-bold leading-tight sm:text-6xl"
        style={{
          color,
          textShadow: `0 0 40px ${color}80, 0 0 80px ${color}40`,
        }}
      >
        {formatRank(rankName, tier)}
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-10 text-xs uppercase tracking-[0.25em] text-text-secondary/60"
      >
        Tap to continue
      </motion.p>
    </motion.div>
  );
}
