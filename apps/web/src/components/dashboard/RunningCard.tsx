"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Footprints, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDashboardStore } from "@/store/useDashboardStore";
import { logRun } from "@/lib/api";

const FITNESS_PILLAR = "Fitness & Nutrition";

export function RunningCard() {
  const target = useDashboardStore((s) => s.running_target);
  const pillars = useDashboardStore((s) => s.pillars);
  const applyXpResult = useDashboardStore((s) => s.applyXpResult);

  const [open, setOpen] = useState(false);
  const [distance, setDistance] = useState("");
  const [pace, setPace] = useState("");
  const [duration, setDuration] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  if (!target) return null;

  const fitnessPillarId = pillars.find((p) => p.name === FITNESS_PILLAR)?._id;

  async function handleLog() {
    const distance_km = parseFloat(distance);
    if (!Number.isFinite(distance_km) || pending) return;
    setPending(true);
    try {
      const result = await logRun({
        distance_km,
        pace_per_km: pace || undefined,
        duration_minutes: duration ? parseFloat(duration) : undefined,
      });
      applyXpResult(result, { pillarId: fitnessPillarId });
      setDone(true);
      setOpen(false);
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
          <Footprints className="h-4 w-4" />
          Running Target
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-6 text-sm">
          <div>
            <p className="text-lg font-semibold tabular-nums text-text-primary">
              {target.target_distance_km} km
            </p>
            <p className="text-xs text-text-secondary">distance</p>
          </div>
          <div>
            <p className="text-lg font-semibold tabular-nums text-text-primary">
              {target.target_pace_per_km}
            </p>
            <p className="text-xs text-text-secondary">pace / km</p>
          </div>
        </div>
        {target.notes && (
          <p className="text-xs text-text-secondary">{target.notes}</p>
        )}

        {done ? (
          <Button
            disabled
            className="w-full bg-fitness text-black hover:bg-fitness/90"
          >
            <Check className="h-4 w-4" /> Run Logged
          </Button>
        ) : !open ? (
          <Button variant="secondary" className="w-full" onClick={() => setOpen(true)}>
            Log Run
          </Button>
        ) : (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="space-y-2 overflow-hidden"
          >
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <label className="text-xs text-text-secondary">km</label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={distance}
                  onChange={(e) => setDistance(e.target.value)}
                  placeholder="5.0"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-text-secondary">pace</label>
                <Input
                  value={pace}
                  onChange={(e) => setPace(e.target.value)}
                  placeholder="5:30"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-text-secondary">min</label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="28"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleLog}
                disabled={pending || !distance}
                className="flex-1 bg-fitness text-black hover:bg-fitness/90"
              >
                {pending ? "Logging…" : "Save Run"}
              </Button>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
