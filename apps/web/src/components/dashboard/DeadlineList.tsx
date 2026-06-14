"use client";

import { Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardStore } from "@/store/useDashboardStore";

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

function urgencyColor(days: number): string {
  if (days <= 1) return "#EF4444";
  if (days <= 3) return "#F59E0B";
  return "#71717A";
}

function label(days: number): string {
  if (days < 0) return "Overdue";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `${days} days`;
}

export function DeadlineList() {
  const deadlines = useDashboardStore((s) => s.upcoming_deadlines);

  const upcoming = deadlines
    .map((d) => ({ ...d, days: daysUntil(d.deadline) }))
    .filter((d) => d.days <= 7)
    .sort((a, b) => a.days - b.days);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-text-secondary" />
          Next 7 Days
        </CardTitle>
      </CardHeader>
      <CardContent>
        {upcoming.length === 0 ? (
          <p className="text-sm text-text-secondary">
            No deadlines in the next week.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {upcoming.map((d, i) => {
              const color = urgencyColor(d.days);
              return (
                <li
                  key={`${d.title}-${i}`}
                  className="flex items-center gap-3 text-sm"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-text-primary">{d.title}</p>
                    <p className="truncate text-xs text-text-secondary">
                      {d.pillar_name}
                    </p>
                  </div>
                  <span
                    className="shrink-0 text-xs font-medium tabular-nums"
                    style={{ color }}
                  >
                    {label(d.days)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
