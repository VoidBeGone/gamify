"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

interface XpBarProps {
  /** 0..1 fill fraction. */
  fraction: number;
  color?: string;
  /** Adds the subtle HUD glow (used for global XP). */
  glow?: boolean;
  className?: string;
}

/** Animated XP fill bar — grows from 0 to `fraction` on mount/update. */
export function XpBar({ fraction, color, glow, className }: XpBarProps) {
  return (
    <div
      className={cn(
        "h-2 w-full overflow-hidden rounded-full bg-surface-raised",
        className,
      )}
    >
      <motion.div
        className={cn("h-full rounded-full", glow && "glow-accent")}
        style={{ backgroundColor: color ?? "var(--color-accent)" }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, Math.max(0, fraction * 100))}%` }}
        transition={{ duration: 0.9, ease: "easeOut" }}
      />
    </div>
  );
}
