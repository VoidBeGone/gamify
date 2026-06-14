"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchDashboard } from "@/lib/api";
import { useDashboardStore } from "@/store/useDashboardStore";
import { ErrorMessage } from "@/components/ui/error-message";
import { GlobalHeader } from "@/components/dashboard/GlobalHeader";
import { NudgeCard } from "@/components/dashboard/NudgeCard";
import { PillarCards } from "@/components/dashboard/PillarCards";
import { TaskList } from "@/components/dashboard/TaskList";
import { WorkoutCard } from "@/components/dashboard/WorkoutCard";
import { RunningCard } from "@/components/dashboard/RunningCard";
import { ChallengeCard } from "@/components/dashboard/ChallengeCard";
import { DeadlineList } from "@/components/dashboard/DeadlineList";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { XpCalendar } from "@/components/dashboard/XpCalendar";

export default function Home() {
  const loaded = useDashboardStore((s) => s.loaded);
  const setDashboard = useDashboardStore((s) => s.setDashboard);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    fetchDashboard()
      .then(setDashboard)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to load dashboard"),
      );
  }, [setDashboard]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      {error ? (
        <ErrorMessage message={error} onRetry={load} />
      ) : !loaded ? (
        <DashboardSkeleton />
      ) : (
        <div className="space-y-6">
          <GlobalHeader />
          <NudgeCard />
          <PillarCards />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <TaskList />
            </div>
            <div className="space-y-4">
              <WorkoutCard />
              <RunningCard />
              <ChallengeCard />
              <DeadlineList />
            </div>
          </div>

          <XpCalendar />
        </div>
      )}
    </main>
  );
}
