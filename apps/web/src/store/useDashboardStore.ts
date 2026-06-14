import { create } from "zustand";
import type {
  BonusOpportunity,
  CelebrationEvent,
  Challenge,
  Dashboard,
  DashboardUser,
  Deadline,
  Debuff,
  Pillar,
  RunningTarget,
  Streak,
  Task,
  Workout,
  XpResult,
} from "@/lib/types";

const STREAK_MILESTONES = new Set([7, 14, 30, 60, 100]);

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export interface XpFloat {
  id: string;
  amount: number;
  bonuses: string[];
  x: number;
  y: number;
}

interface DashboardState {
  loaded: boolean;

  user: DashboardUser | null;
  streak: Streak | null;
  todays_tasks: Task[];
  todays_workout: Workout | null;
  running_target: RunningTarget | null;
  todays_challenge: Challenge | null;
  pillars: Pillar[];
  upcoming_deadlines: Deadline[];
  nudge: string;
  nudgeDismissed: boolean;
  active_debuffs: Debuff[];
  bonus_opportunities: BonusOpportunity[];

  /** Events waiting to be displayed. xp_gain events drain into xpFloats. */
  celebrationQueue: CelebrationEvent[];
  /** Active XP floats rendered simultaneously by CelebrationManager. */
  xpFloats: XpFloat[];

  // actions
  setDashboard: (data: Dashboard) => void;
  dismissNudge: () => void;
  enqueueCelebration: (event: Omit<CelebrationEvent, "id">) => void;
  /** Remove the first non-xp_gain event (the one currently displayed). */
  dequeueBlockingCelebration: () => void;
  /**
   * Move all xp_gain events from celebrationQueue into xpFloats so they render
   * simultaneously without blocking other events.
   */
  drainXpGainsToFloats: () => void;
  /** Remove a float by id once its animation completes. */
  removeXpFloat: (id: string) => void;
  markTaskCompleted: (taskId: string) => void;
  markTaskUncompleted: (taskId: string) => void;
  revertXp: (amount: number, pillarId?: string) => void;
  removeTaskFromToday: (taskId: string) => void;
  markChallengeCompleted: () => void;
  applyXpResult: (
    result: XpResult,
    ctx?: { pillarId?: string; pillarColor?: string },
  ) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  loaded: false,

  user: null,
  streak: null,
  todays_tasks: [],
  todays_workout: null,
  running_target: null,
  todays_challenge: null,
  pillars: [],
  upcoming_deadlines: [],
  nudge: "",
  nudgeDismissed: false,
  active_debuffs: [],
  bonus_opportunities: [],

  celebrationQueue: [],
  xpFloats: [],

  setDashboard: (data) =>
    set((s) => {
      const streakEvents: CelebrationEvent[] = [];
      const days = data.streak?.current_streak ?? 0;
      if (STREAK_MILESTONES.has(days)) {
        streakEvents.push({ id: uid(), type: "streak", data: { days } });
      }
      return {
        loaded: true,
        user: data.user,
        streak: data.streak,
        todays_tasks: data.todays_tasks,
        todays_workout: data.todays_workout,
        running_target: data.running_target,
        todays_challenge: data.todays_challenge,
        pillars: data.pillars,
        upcoming_deadlines: data.upcoming_deadlines,
        nudge: data.nudge,
        nudgeDismissed: false,
        active_debuffs: data.active_debuffs,
        bonus_opportunities: data.bonus_opportunities,
        celebrationQueue: [...s.celebrationQueue, ...streakEvents],
      };
    }),

  dismissNudge: () => set({ nudgeDismissed: true }),

  enqueueCelebration: (event) =>
    set((s) => ({
      celebrationQueue: [
        ...s.celebrationQueue,
        { id: uid(), ...event } as CelebrationEvent,
      ],
    })),

  dequeueBlockingCelebration: () =>
    set((s) => {
      const idx = s.celebrationQueue.findIndex((e) => e.type !== "xp_gain");
      if (idx === -1) return {};
      return {
        celebrationQueue: [
          ...s.celebrationQueue.slice(0, idx),
          ...s.celebrationQueue.slice(idx + 1),
        ],
      };
    }),

  drainXpGainsToFloats: () =>
    set((s) => {
      const gains = s.celebrationQueue.filter(
        (e): e is Extract<CelebrationEvent, { type: "xp_gain" }> =>
          e.type === "xp_gain",
      );
      if (gains.length === 0) return {};
      return {
        celebrationQueue: s.celebrationQueue.filter((e) => e.type !== "xp_gain"),
        xpFloats: [
          ...s.xpFloats,
          ...gains.map((g) => ({
            id: g.id,
            amount: g.data.amount,
            bonuses: g.data.bonuses,
            x: g.data.x,
            y: g.data.y,
          })),
        ],
      };
    }),

  removeXpFloat: (id) =>
    set((s) => ({ xpFloats: s.xpFloats.filter((f) => f.id !== id) })),

  markTaskCompleted: (taskId) =>
    set((s) => ({
      todays_tasks: s.todays_tasks.map((t) =>
        t._id === taskId ? { ...t, is_completed: true } : t,
      ),
    })),

  markTaskUncompleted: (taskId) =>
    set((s) => ({
      todays_tasks: s.todays_tasks.map((t) =>
        t._id === taskId ? { ...t, is_completed: false } : t,
      ),
    })),

  revertXp: (amount, pillarId) =>
    set((s) => ({
      user: s.user
        ? { ...s.user, global_xp: Math.max(0, s.user.global_xp - amount) }
        : s.user,
      pillars: s.pillars.map((p) =>
        p._id === pillarId ? { ...p, xp: Math.max(0, p.xp - amount) } : p,
      ),
    })),

  removeTaskFromToday: (taskId) =>
    set((s) => ({
      todays_tasks: s.todays_tasks.filter((t) => t._id !== taskId),
    })),

  markChallengeCompleted: () =>
    set((s) => ({
      todays_challenge: s.todays_challenge
        ? { ...s.todays_challenge, is_completed: true }
        : null,
    })),

  applyXpResult: (result, ctx) =>
    set((s) => {
      const queued: CelebrationEvent[] = [];

      let user = s.user;
      if (user) {
        user = { ...user, global_xp: user.global_xp + result.xp_awarded };
        if (result.rank_up?.global) {
          const { from, to } = result.rank_up.global;
          user = {
            ...user,
            global_rank_name: to.rank_name,
            global_rank_tier: to.tier,
          };
          queued.push({
            id: uid(),
            type: from.rank_name !== to.rank_name ? "rank_up" : "tier_up",
            data: {
              rank_name: to.rank_name,
              tier: to.tier,
              color: "#3B82F6",
              is_global: true,
            },
          } as CelebrationEvent);
        }
      }

      let pillars = s.pillars;
      if (ctx?.pillarId) {
        const acting = s.pillars.find((p) => p._id === ctx.pillarId);
        const color = ctx.pillarColor ?? acting?.color ?? "#3B82F6";
        pillars = s.pillars.map((p) =>
          p._id === ctx.pillarId
            ? {
                ...p,
                xp: p.xp + result.xp_awarded,
                neglect_status: "healthy" as const,
                ...(result.rank_up?.pillar
                  ? {
                      rank_name: result.rank_up.pillar.to.rank_name,
                      rank_tier: result.rank_up.pillar.to.tier,
                    }
                  : {}),
              }
            : p,
        );
        if (result.rank_up?.pillar) {
          const { from, to } = result.rank_up.pillar;
          queued.push({
            id: uid(),
            type: from.rank_name !== to.rank_name ? "rank_up" : "tier_up",
            data: {
              rank_name: to.rank_name,
              tier: to.tier,
              color,
              is_global: false,
            },
          } as CelebrationEvent);
        }
      }

      for (const achievement of result.achievement_unlocked ?? []) {
        queued.push({
          id: uid(),
          type: "achievement",
          data: {
            title: achievement.title ?? achievement.name ?? "Achievement Unlocked",
            description: achievement.description,
            xp_reward: achievement.xp_reward,
          },
        });
      }

      return {
        user,
        pillars,
        celebrationQueue: [...s.celebrationQueue, ...queued],
      };
    }),
}));
