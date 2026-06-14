"use client";

import { useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { useDashboardStore } from "@/store/useDashboardStore";
import { XPGainFloat } from "./XPGainFloat";
import { TierUpBanner } from "./TierUpBanner";
import { RankUpOverlay } from "./RankUpOverlay";
import { AchievementToast } from "./AchievementToast";
import { StreakBanner } from "./StreakBanner";
import type { CelebrationEvent } from "@/lib/types";

/**
 * Reads from the global celebrationQueue and renders the appropriate component.
 *
 * - xp_gain events are drained into the xpFloats Zustand slice so multiple
 *   completions animate simultaneously (fire-and-forget, 1.5 s).
 * - All other types (tier_up, rank_up, achievement, streak) are shown one at
 *   a time via AnimatePresence and auto-dequeue when they dismiss.
 *
 * Mounted once in the root layout so it works across all pages.
 */
export function CelebrationManager() {
  const queue = useDashboardStore((s) => s.celebrationQueue);
  const xpFloats = useDashboardStore((s) => s.xpFloats);
  const drainXpGainsToFloats = useDashboardStore((s) => s.drainXpGainsToFloats);
  const removeXpFloat = useDashboardStore((s) => s.removeXpFloat);
  const dequeueBlocking = useDashboardStore((s) => s.dequeueBlockingCelebration);

  // Drain all xp_gain events out of the queue and into xpFloats atomically.
  // Both are Zustand actions — no React setState in the effect body.
  useEffect(() => {
    const hasGains = queue.some((e) => e.type === "xp_gain");
    if (hasGains) drainXpGainsToFloats();
  }, [queue, drainXpGainsToFloats]);

  // First blocking event in the queue (skipping any stale xp_gain events that
  // haven't been drained yet on this render cycle).
  const blocking = queue.find((e) => e.type !== "xp_gain") ?? null;

  return (
    <>
      {/* XP floats — multiple render simultaneously at their viewport coords */}
      {xpFloats.map((f) => (
        <XPGainFloat
          key={f.id}
          amount={f.amount}
          bonuses={f.bonuses}
          x={f.x}
          y={f.y}
          onComplete={() => removeXpFloat(f.id)}
        />
      ))}

      {/* Blocking celebrations — one at a time with shared exit animation */}
      <AnimatePresence mode="wait">
        {blocking && (
          <BlockingCelebration
            key={blocking.id}
            event={blocking}
            onDismiss={dequeueBlocking}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function BlockingCelebration({
  event,
  onDismiss,
}: {
  event: CelebrationEvent;
  onDismiss: () => void;
}) {
  switch (event.type) {
    case "tier_up":
      return (
        <TierUpBanner
          rankName={event.data.rank_name}
          tier={event.data.tier}
          color={event.data.color}
          onDismiss={onDismiss}
        />
      );

    case "rank_up":
      return (
        <RankUpOverlay
          rankName={event.data.rank_name}
          tier={event.data.tier}
          color={event.data.color}
          isGlobal={event.data.is_global}
          onDismiss={onDismiss}
        />
      );

    case "achievement":
      return (
        <AchievementToast
          title={event.data.title}
          description={event.data.description}
          xpReward={event.data.xp_reward}
          onDismiss={onDismiss}
        />
      );

    case "streak":
      return <StreakBanner days={event.data.days} onDismiss={onDismiss} />;

    default:
      return null;
  }
}
