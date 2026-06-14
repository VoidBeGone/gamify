"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Flame, AlertTriangle } from "lucide-react";
import { useDashboardStore } from "@/store/useDashboardStore";
import { formatRank, rankProgress } from "@/lib/rank";
import { XpBar } from "./XpBar";

export function GlobalHeader() {
  const user = useDashboardStore((s) => s.user);
  const streak = useDashboardStore((s) => s.streak);
  const debuffs = useDashboardStore((s) => s.active_debuffs);

  if (!user) return null;

  const progress = rankProgress(user.global_xp);
  const hasCritical = debuffs.some((d) => d.status === "critical");

  return (
    <header className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.2em] text-text-secondary">
            {user.name}
          </p>
          <h1 className="truncate font-display text-2xl font-semibold text-text-primary sm:text-3xl">
            <span
              className="bg-gradient-to-r from-accent to-content bg-clip-text text-transparent"
              style={{ textShadow: "0 0 24px rgba(59,130,246,0.25)" }}
            >
              {formatRank(user.global_rank_name, user.global_rank_tier)}
            </span>
          </h1>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5">
          <Flame
            className="h-4 w-4 text-sidequest"
            fill={streak && streak.current_streak > 0 ? "currentColor" : "none"}
          />
          <span className="text-sm font-semibold tabular-nums text-text-primary">
            {streak?.current_streak ?? 0}
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        <XpBar fraction={progress.fraction} glow />
        <div className="flex justify-between text-xs tabular-nums text-text-secondary">
          <span>{user.global_xp.toLocaleString()} XP</span>
          <span>
            {progress.remaining === null
              ? "Max rank"
              : `${progress.remaining.toLocaleString()} to next rank`}
          </span>
        </div>
      </div>

      <AnimatePresence>
        {debuffs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div
              className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-sm ${
                hasCritical
                  ? "border-debuff-critical/40 bg-debuff-critical/10 text-debuff-critical"
                  : "border-debuff-warning/40 bg-debuff-warning/10 text-debuff-warning"
              }`}
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="space-y-0.5">
                {debuffs.map((d) => (
                  <p key={d.pillar_name}>
                    <span className="font-semibold">{d.pillar_name}</span>{" "}
                    {d.status} — other pillars earn at{" "}
                    {Math.round(d.xp_multiplier * 100)}% until you return.
                  </p>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
