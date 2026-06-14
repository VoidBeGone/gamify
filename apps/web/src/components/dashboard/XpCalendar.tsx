"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface XpDayEvent {
  type: string;
  description: string;
  xp: number;
}

interface XpDay {
  date: string;
  xp_earned: number;
  events: XpDayEvent[];
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

const API_KEY = process.env.NEXT_PUBLIC_API_KEY ?? "";

async function fetchXpCalendar(weeks = 12): Promise<XpDay[]> {
  const months = Math.ceil(weeks / 4);
  const res = await fetch(`/api/v1/xp/calendar?months=${months}`, {
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
  });
  const body = await res.json();
  if (!res.ok || !body.success) return [];
  return body.data as XpDay[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cellColor(xp: number): string {
  if (xp <= 0) return "#1A1A1F";
  if (xp <= 50) return "rgba(59,130,246,0.25)";
  if (xp <= 150) return "rgba(59,130,246,0.50)";
  if (xp <= 300) return "rgba(59,130,246,0.75)";
  return "#3B82F6";
}

const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Build the last N weeks as columns of 7 days (Mon–Sun)
function buildGrid(
  days: XpDay[],
  weeks: number
): { date: string; xp: number; events: XpDayEvent[] }[][] {
  const byDate = new Map(days.map((d) => [d.date, d]));

  const today = new Date();
  // Find the most recent Sunday
  const endSunday = new Date(today);
  endSunday.setDate(today.getDate() + (7 - today.getDay()) % 7);

  const columns: { date: string; xp: number; events: XpDayEvent[] }[][] = [];

  for (let w = weeks - 1; w >= 0; w--) {
    const col: { date: string; xp: number; events: XpDayEvent[] }[] = [];
    for (let d = 1; d <= 7; d++) { // Mon=1, Sun=7 (using ISO weekday)
      const dayOffset = w * 7 + (7 - d); // how many days back from endSunday
      const cellDate = new Date(endSunday);
      cellDate.setDate(endSunday.getDate() - dayOffset);
      const key = cellDate.toISOString().slice(0, 10);
      const entry = byDate.get(key);
      col.push({ date: key, xp: entry?.xp_earned ?? 0, events: entry?.events ?? [] });
    }
    columns.push(col);
  }

  return columns;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function XpCalendar() {
  const [data, setData] = useState<XpDay[]>([]);
  const [modalDay, setModalDay] = useState<{ date: string; xp: number; events: XpDayEvent[] } | null>(null);

  const load = useCallback(async () => {
    const d = await fetchXpCalendar(12);
    setData(d);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const WEEKS = 12;
  const grid = buildGrid(data, WEEKS);

  // Month labels: find first column of each month
  const monthLabels: { col: number; label: string }[] = [];
  grid.forEach((col, i) => {
    const firstDate = col[0].date;
    const month = new Date(firstDate + "T00:00:00").toLocaleDateString("en-US", { month: "short" });
    if (i === 0 || grid[i - 1][0].date.slice(0, 7) !== firstDate.slice(0, 7)) {
      monthLabels.push({ col: i, label: month });
    }
  });

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto pt-2">
          <div
            className="inline-grid gap-1"
            style={{
              gridTemplateColumns: `28px repeat(${WEEKS}, 13px)`,
              gridTemplateRows: `auto repeat(7, 13px)`,
            }}
          >
            {/* Month labels row */}
            <div />
            {grid.map((col, ci) => {
              const ml = monthLabels.find((m) => m.col === ci);
              return (
                <div key={ci} className="text-[9px] text-text-secondary" style={{ lineHeight: "13px" }}>
                  {ml?.label ?? ""}
                </div>
              );
            })}

            {/* Day rows */}
            {DOW_LABELS.map((dow, ri) => (
              <Fragment key={ri}>
                <div
                  className="flex items-center text-[9px] text-text-secondary"
                  style={{ lineHeight: "13px" }}
                >
                  {ri % 2 === 0 ? dow : ""}
                </div>
                {grid.map((col, ci) => {
                  const cell = col[ri];
                  return (
                    <button
                      key={`${ci}-${ri}`}
                      title={cell.xp > 0 ? `${cell.date}: ${cell.xp} XP` : cell.date}
                      onClick={() => cell.xp > 0 && setModalDay(cell)}
                      className="h-3 w-3 rounded-sm transition-opacity hover:opacity-80"
                      style={{ backgroundColor: cellColor(cell.xp) }}
                    />
                  );
                })}
              </Fragment>
            ))}
          </div>

          {/* Scale */}
          <div className="mt-3 flex items-center gap-1.5 text-[10px] text-text-secondary">
            <span>Less</span>
            {[0, 25, 100, 225, 400].map((xp) => (
              <span
                key={xp}
                className="inline-block h-3 w-3 rounded-sm"
                style={{ backgroundColor: cellColor(xp) }}
              />
            ))}
            <span>More</span>
          </div>
        </CardContent>
      </Card>

      {/* Day detail modal */}
      {modalDay && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setModalDay(null)}
        >
          <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="font-semibold text-text-primary">
                  {new Date(modalDay.date + "T00:00:00").toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                <p className="text-sm font-bold text-[#3B82F6]">+{modalDay.xp} XP</p>
              </div>
              <button
                onClick={() => setModalDay(null)}
                className="text-xs text-text-secondary hover:text-text-primary"
              >
                Close
              </button>
            </div>
            <div className="divide-y divide-border/50">
              {modalDay.events.map((e, i) => (
                <div key={i} className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-text-primary">{e.description}</span>
                  <span className="text-xs font-semibold text-[#3B82F6]">+{e.xp}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
