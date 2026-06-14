/**
 * Normalized domain types consumed by the UI.
 *
 * These are the *clean* shapes the components work with. The real API returns
 * slightly different field names (e.g. `username`, `today_tasks`, `base_xp`,
 * `workout.session`, `debuffs`); the mapping happens in `lib/api.ts`.
 */

export type Difficulty = "easy" | "medium" | "hard" | "epic";
export type NeglectStatus = "healthy" | "warning" | "neglected" | "critical";

export interface DashboardUser {
  name: string;
  global_xp: number;
  global_rank_name: string;
  global_rank_tier: number;
}

export interface Streak {
  current_streak: number;
  longest_streak: number;
}

export interface Task {
  _id: string;
  title: string;
  xp: number;
  difficulty: Difficulty;
  pillar_id: string;
  pillar_name: string;
  pillar_color: string;
  is_completed: boolean;
}

export type ExerciseType = "weighted" | "bodyweight" | "cardio";

export interface Exercise {
  name: string;
  sets: number;
  reps: string;
  rest_seconds?: number;
  notes?: string;
  exercise_type?: ExerciseType;
}

export interface Workout {
  session_type: string;
  exercises: Exercise[];
}

export interface RunningTarget {
  target_distance_km: number;
  target_pace_per_km: string;
  notes?: string;
}

export interface Challenge {
  /** Synthetic client id — the API completes challenges by date, not id. */
  id: string;
  title: string;
  description?: string;
  xp_reward: number;
  is_completed: boolean;
  is_surprise: boolean;
}

export interface Pillar {
  _id: string;
  name: string;
  xp: number;
  rank_name: string;
  rank_tier: number;
  neglect_status: NeglectStatus;
  color: string;
  last_activity_date?: string;
}

export interface Deadline {
  title: string;
  deadline: string;
  pillar_name: string;
}

export interface Debuff {
  pillar_name: string;
  status: NeglectStatus;
  xp_multiplier: number;
}

export interface BonusOpportunity {
  description: string;
  xp: number;
}

export interface Dashboard {
  user: DashboardUser;
  streak: Streak;
  todays_tasks: Task[];
  todays_workout: Workout | null;
  running_target: RunningTarget | null;
  todays_challenge: Challenge | null;
  pillars: Pillar[];
  upcoming_deadlines: Deadline[];
  nudge: string;
  active_debuffs: Debuff[];
  bonus_opportunities: BonusOpportunity[];
}

/** Rank-up payload emitted by the XP engine. */
export interface RankUp {
  from: { rank_name: string; tier: number };
  to: { rank_name: string; tier: number };
}

export interface UnlockedAchievement {
  name?: string;
  title?: string;
  description?: string;
  xp_reward?: number;
}

/** The XP engine result attached to every mutating response. */
export interface XpResult {
  xp_awarded: number;
  bonuses_triggered: string[];
  rank_up: { pillar?: RankUp; global?: RankUp } | null;
  achievement_unlocked: UnlockedAchievement[];
}

// ---------------------------------------------------------------------------
// Celebration queue
// ---------------------------------------------------------------------------

/**
 * A single event in the global celebration queue.
 *
 * `xp_gain` events are drained and rendered simultaneously (fire-and-forget,
 * 1.5 s). All other types are shown one-at-a-time by CelebrationManager.
 */
export type CelebrationEvent =
  | {
      id: string;
      type: "xp_gain";
      data: {
        /** Total XP awarded (including bonuses). */
        amount: number;
        /** Raw bonus keys from the XP engine, e.g. "all_pillar_day". */
        bonuses: string[];
        /** Viewport X of the triggering element (for fixed-position float). */
        x: number;
        /** Viewport Y of the triggering element. */
        y: number;
      };
    }
  | {
      id: string;
      type: "tier_up";
      data: {
        /** New rank name (same as previous rank_name for a tier advance). */
        rank_name: string;
        tier: number;
        /** Pillar hex color, or undefined for global tier advances. */
        color: string;
      };
    }
  | {
      id: string;
      type: "rank_up";
      data: {
        /** New rank name (different from previous — the big moment). */
        rank_name: string;
        tier: number;
        color: string;
        is_global: boolean;
      };
    }
  | {
      id: string;
      type: "achievement";
      data: {
        title: string;
        description?: string;
        xp_reward?: number;
      };
    }
  | {
      id: string;
      type: "streak";
      data: {
        days: number;
      };
    };
