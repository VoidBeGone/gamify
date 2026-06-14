"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import { useDashboardStore } from "@/store/useDashboardStore";

export function NudgeCard() {
  const nudge = useDashboardStore((s) => s.nudge);
  const dismissed = useDashboardStore((s) => s.nudgeDismissed);
  const dismissNudge = useDashboardStore((s) => s.dismissNudge);

  const show = !!nudge && !dismissed;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0, marginTop: 0 }}
          className="flex items-center gap-2.5 rounded-xl border border-border bg-surface/60 px-3 py-2 text-sm text-text-secondary"
        >
          <Sparkles className="h-4 w-4 shrink-0 text-accent" />
          <p className="min-w-0 flex-1 truncate">{nudge}</p>
          <button
            onClick={dismissNudge}
            aria-label="Dismiss nudge"
            className="shrink-0 rounded-md p-1 text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
