"use client";

import { useState } from "react";
import { Dumbbell, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDashboardStore } from "@/store/useDashboardStore";
import { completeWorkout, type WorkoutExerciseLog } from "@/lib/api";

const FITNESS_PILLAR = "Fitness & Nutrition";

export function WorkoutCard() {
  const workout = useDashboardStore((s) => s.todays_workout);
  const pillars = useDashboardStore((s) => s.pillars);
  const applyXpResult = useDashboardStore((s) => s.applyXpResult);

  const [weights, setWeights] = useState<Record<number, string>>({});
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  if (!workout) return null;

  const fitnessPillarId = pillars.find((p) => p.name === FITNESS_PILLAR)?._id;

  async function handleComplete() {
    if (pending || done || !workout) return;
    setPending(true);
    const exercises: WorkoutExerciseLog[] = workout.exercises.map((ex, i) => {
      const weight = parseFloat(weights[i]);
      return {
        name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        ...(Number.isFinite(weight) ? { weight } : {}),
      };
    });
    try {
      const result = await completeWorkout(exercises);
      applyXpResult(result, { pillarId: fitnessPillarId });
      setDone(true);
    } catch {
      // ignore — refresh will reconcile
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-fitness">
          <Dumbbell className="h-4 w-4" />
          {workout.session_type}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-2.5">
          {workout.exercises.map((ex, i) => (
            <li
              key={`${ex.name}-${i}`}
              className="flex items-center gap-3 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-text-primary">{ex.name}</p>
                <p className="text-xs tabular-nums text-text-secondary">
                  {ex.sets} × {ex.reps}
                  {ex.rest_seconds ? ` · ${ex.rest_seconds}s rest` : ""}
                </p>
              </div>
              {(!ex.exercise_type || ex.exercise_type === "weighted") && (
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    inputMode="decimal"
                    placeholder="lbs"
                    value={weights[i] ?? ""}
                    onChange={(e) =>
                      setWeights((w) => ({ ...w, [i]: e.target.value }))
                    }
                    disabled={done}
                    className="h-8 w-16 text-center"
                    aria-label={`Weight for ${ex.name}`}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>

        <Button
          onClick={handleComplete}
          disabled={pending || done}
          className="w-full bg-fitness text-black hover:bg-fitness/90"
        >
          {done ? (
            <>
              <Check className="h-4 w-4" /> Workout Logged
            </>
          ) : pending ? (
            "Logging…"
          ) : (
            "Complete Workout"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
