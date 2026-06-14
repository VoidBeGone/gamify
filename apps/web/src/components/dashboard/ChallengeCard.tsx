"use client";

import { useState } from "react";
import { Zap, Target, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDashboardStore } from "@/store/useDashboardStore";
import { completeChallenge } from "@/lib/api";

export function ChallengeCard() {
  const challenge = useDashboardStore((s) => s.todays_challenge);
  const markChallengeCompleted = useDashboardStore((s) => s.markChallengeCompleted);
  const applyXpResult = useDashboardStore((s) => s.applyXpResult);
  const [pending, setPending] = useState(false);

  if (!challenge) return null;

  async function handleComplete() {
    if (pending || challenge!.is_completed) return;
    setPending(true);
    try {
      const result = await completeChallenge();
      markChallengeCompleted();
      applyXpResult(result);
    } catch {
      // ignore — refresh will reconcile
    } finally {
      setPending(false);
    }
  }

  return (
    <Card
      className={
        challenge.is_surprise ? "border-sidequest/40 glow-accent" : undefined
      }
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {challenge.is_surprise ? (
            <Zap className="h-4 w-4 text-sidequest" fill="currentColor" />
          ) : (
            <Target className="h-4 w-4 text-accent" />
          )}
          {challenge.is_surprise ? "Surprise Challenge" : "Today's Challenge"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-sm font-medium text-text-primary">
            {challenge.title}
          </p>
          {challenge.description && (
            <p className="mt-0.5 text-sm text-text-secondary">
              {challenge.description}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between">
          <Badge className="bg-sidequest/15 text-sidequest">
            +{challenge.xp_reward} XP
          </Badge>
          <Button
            size="sm"
            onClick={handleComplete}
            disabled={pending || challenge.is_completed}
            className="bg-sidequest text-black hover:bg-sidequest/90"
          >
            {challenge.is_completed ? (
              <>
                <Check className="h-4 w-4" /> Done
              </>
            ) : pending ? (
              "…"
            ) : (
              "Complete"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
