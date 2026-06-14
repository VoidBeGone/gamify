"use client";

import { Card, CardContent } from "@/components/ui/card";
import { useDashboardStore } from "@/store/useDashboardStore";
import { formatRank, rankProgress } from "@/lib/rank";
import { XpBar } from "./XpBar";
import type { NeglectStatus } from "@/lib/types";

const STATUS_COLOR: Record<NeglectStatus, string> = {
  healthy: "#22C55E",
  warning: "#EAB308",
  neglected: "#F59E0B",
  critical: "#EF4444",
};

function relativeDay(iso?: string): string {
  if (!iso) return "No activity yet";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "No activity yet";
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "Active today";
  if (days === 1) return "Active yesterday";
  return `${days} days ago`;
}

export function PillarCards() {
  const pillars = useDashboardStore((s) => s.pillars);

  if (pillars.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {pillars.map((pillar) => {
        const progress = rankProgress(pillar.xp);
        return (
          <Card key={pillar._id}>
            <CardContent className="space-y-3 pt-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs uppercase tracking-wide text-text-secondary">
                    {pillar.name}
                  </p>
                  <p
                    className="truncate font-display text-base font-semibold"
                    style={{ color: pillar.color }}
                  >
                    {formatRank(pillar.rank_name, pillar.rank_tier)}
                  </p>
                </div>
                <span
                  className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: STATUS_COLOR[pillar.neglect_status] }}
                  title={pillar.neglect_status}
                />
              </div>

              <XpBar fraction={progress.fraction} color={pillar.color} />

              <div className="flex items-center justify-between text-xs tabular-nums text-text-secondary">
                <span>{pillar.xp.toLocaleString()} XP</span>
                <span>{relativeDay(pillar.last_activity_date)}</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
