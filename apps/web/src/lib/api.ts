import type {
  Dashboard,
  Difficulty,
  Pillar,
  Task,
  XpResult,
} from "./types";

const API_KEY = process.env.NEXT_PUBLIC_API_KEY;

/** Standard API envelope. */
interface Envelope<T> {
  success: boolean;
  data: T;
  error?: string;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY ?? "",
      ...options.headers,
    },
  });

  let body: Envelope<T> | null = null;
  try {
    body = (await res.json()) as Envelope<T>;
  } catch {
    // fall through to status-based error below
  }

  if (!res.ok || !body?.success) {
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return body.data;
}

// ---------------------------------------------------------------------------
// Raw API shapes (what the Express backend actually returns).
// ---------------------------------------------------------------------------

interface RawDashboard {
  user: {
    username: string;
    global_xp: number;
    global_rank_name: string;
    global_rank_tier: number;
  };
  streak: { current_streak: number; longest_streak: number } | null;
  today_tasks: Array<{
    _id: string;
    title: string;
    difficulty: Difficulty;
    base_xp: number;
    is_completed: boolean;
    pillar_id: string;
  }>;
  workout: {
    day_name: string;
    is_rest_day: boolean;
    session: {
      session_type: string;
      exercises: Array<{
        name: string;
        sets: number;
        reps: string;
        rest_seconds?: number;
        notes?: string;
        exercise_type?: "weighted" | "bodyweight" | "cardio";
      }>;
    } | null;
  } | null;
  running_target: {
    target_distance_km: number;
    target_pace_per_km: string;
    notes?: string;
  } | null;
  challenge: {
    title: string;
    description?: string;
    xp: number;
    is_surprise: boolean;
  } | null;
  pillars: Array<{
    _id: string;
    name: string;
    xp: number;
    rank_name: string;
    rank_tier: number;
    neglect_status: Pillar["neglect_status"];
    color: string;
    last_activity_date?: string;
  }>;
  deadlines: Array<{ title: string; deadline: string; goal_title: string }>;
  nudge: string;
  debuffs: Array<{
    pillar: string;
    status: Pillar["neglect_status"];
    xp_multiplier: number;
  }>;
  bonuses_today: Array<{ description: string; xp: number }>;
}

interface RawXpResult {
  xp_awarded: number;
  bonuses_triggered: string[];
  rank_up: XpResult["rank_up"];
  achievement_unlocked: XpResult["achievement_unlocked"];
}

// ---------------------------------------------------------------------------
// Normalization: raw API -> clean domain shapes.
// ---------------------------------------------------------------------------

function normalizeDashboard(raw: RawDashboard): Dashboard {
  const colorByPillarId = new Map(raw.pillars.map((p) => [p._id, p]));

  const todays_tasks: Task[] = raw.today_tasks.map((t) => {
    const pillar = colorByPillarId.get(t.pillar_id);
    return {
      _id: t._id,
      title: t.title,
      xp: t.base_xp,
      difficulty: t.difficulty,
      pillar_id: t.pillar_id,
      pillar_name: pillar?.name ?? "Unsorted",
      pillar_color: pillar?.color ?? "#71717A",
      is_completed: t.is_completed,
    };
  });

  const showWorkout =
    raw.workout && !raw.workout.is_rest_day && raw.workout.session;

  return {
    user: {
      name: raw.user.username,
      global_xp: raw.user.global_xp,
      global_rank_name: raw.user.global_rank_name,
      global_rank_tier: raw.user.global_rank_tier,
    },
    streak: {
      current_streak: raw.streak?.current_streak ?? 0,
      longest_streak: raw.streak?.longest_streak ?? 0,
    },
    todays_tasks,
    todays_workout: showWorkout
      ? {
          session_type: raw.workout!.session!.session_type,
          exercises: raw.workout!.session!.exercises,
        }
      : null,
    running_target: raw.running_target,
    todays_challenge: raw.challenge
      ? {
          id: raw.challenge.title,
          title: raw.challenge.title,
          description: raw.challenge.description,
          xp_reward: raw.challenge.xp,
          is_completed: false,
          is_surprise: raw.challenge.is_surprise,
        }
      : null,
    pillars: raw.pillars,
    upcoming_deadlines: raw.deadlines.map((d) => ({
      title: d.title,
      deadline: d.deadline,
      pillar_name: d.goal_title,
    })),
    nudge: raw.nudge,
    active_debuffs: raw.debuffs.map((d) => ({
      pillar_name: d.pillar,
      status: d.status,
      xp_multiplier: d.xp_multiplier,
    })),
    bonus_opportunities: raw.bonuses_today,
  };
}

// ---------------------------------------------------------------------------
// Public API.
// ---------------------------------------------------------------------------

export async function fetchDashboard(): Promise<Dashboard> {
  const raw = await request<RawDashboard>("/dashboard");
  return normalizeDashboard(raw);
}

export async function completeTask(taskId: string): Promise<XpResult> {
  const data = await request<{ xp_result: RawXpResult }>(
    `/tasks/${taskId}/complete`,
    { method: "PATCH" },
  );
  return data.xp_result;
}

export interface WorkoutExerciseLog {
  name: string;
  sets: number;
  reps: string;
  weight?: number;
}

export async function completeWorkout(
  exercises: WorkoutExerciseLog[],
  notes?: string,
): Promise<XpResult> {
  const data = await request<{ xp_result: RawXpResult }>("/metrics/workout", {
    method: "POST",
    body: JSON.stringify({ exercises, notes }),
  });
  return data.xp_result;
}

export interface RunLog {
  distance_km: number;
  pace_per_km?: string;
  duration_minutes?: number;
}

export async function logRun(run: RunLog): Promise<XpResult> {
  const data = await request<{ xp_result: RawXpResult }>("/metrics/run", {
    method: "POST",
    body: JSON.stringify(run),
  });
  return data.xp_result;
}

// ---------------------------------------------------------------------------
// Metrics logging
// ---------------------------------------------------------------------------

export interface MetricPoint {
  value: number;
  secondary_value?: number;
  notes?: string;
  logged_at: string;
}

export interface LatestMetric {
  metric_type: string;
  value: number;
  secondary_value?: number;
  logged_at: string;
  notes?: string;
}

export interface ExercisePr {
  exercise: string;
  weight_kg: number;
  date: string;
}

export async function fetchLatestMetrics(): Promise<LatestMetric[]> {
  return request<LatestMetric[]>("/metrics/latest");
}

export async function fetchMetricHistory(
  metric_type: string,
  days = 90,
): Promise<MetricPoint[]> {
  return request<MetricPoint[]>(
    `/metrics/history?metric_type=${encodeURIComponent(metric_type)}&days=${days}`,
  );
}

export async function fetchExercisePrs(): Promise<ExercisePr[]> {
  return request<ExercisePr[]>("/metrics/exercise-prs");
}

export async function logMetric(
  metric_type: string,
  value: number,
  opts?: { secondary_value?: number; notes?: string },
): Promise<void> {
  await request("/metrics", {
    method: "POST",
    body: JSON.stringify({ metric_type, value, ...opts }),
  });
}

export interface SidequestLog {
  title: string;
  description?: string;
  link?: string;
  date?: string;
}

export async function logSidequest(quest: SidequestLog): Promise<XpResult> {
  const data = await request<{ xp_result: RawXpResult }>("/metrics/sidequest", {
    method: "POST",
    body: JSON.stringify(quest),
  });
  return data.xp_result;
}

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

export interface GoalTask {
  _id: string;
  title: string;
  difficulty: Difficulty;
  base_xp: number;
  scheduled_date?: string;
  is_completed: boolean;
  completed_at?: string;
}

export interface GoalSubgoal {
  _id: string;
  title: string;
  difficulty: Difficulty;
  base_xp: number;
  deadline?: string;
  status: "pending" | "in_progress" | "completed";
  completed_at?: string;
  tasks: GoalTask[];
}

export interface GoalItem {
  _id: string;
  pillar_id: string;
  title: string;
  description?: string;
  deadline?: string;
  status: "active" | "completed" | "abandoned";
  subgoals: GoalSubgoal[];
}

export interface PillarGroup {
  pillar: { _id: string; name: string; color: string };
  goals: GoalItem[];
}

export async function fetchGoals(): Promise<PillarGroup[]> {
  return request<PillarGroup[]>("/goals");
}

export async function fetchGoal(id: string): Promise<GoalItem> {
  return request<GoalItem>(`/goals/${id}`);
}

export async function createGoal(data: {
  pillar_id: string;
  title: string;
  description?: string;
  deadline?: string;
}): Promise<GoalItem> {
  return request<GoalItem>("/goals", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function createSubgoal(data: {
  goal_id: string;
  title: string;
  difficulty: Difficulty;
  deadline?: string;
}): Promise<GoalSubgoal> {
  return request<GoalSubgoal>("/subgoals", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function completeSubgoal(id: string): Promise<XpResult> {
  const data = await request<{ subgoal: unknown; xp_result: RawXpResult }>(
    `/subgoals/${id}/complete`,
    { method: "PATCH" },
  );
  return data.xp_result;
}

export async function createTask(data: {
  subgoal_id: string;
  title: string;
  difficulty: Difficulty;
  scheduled_date?: string;
}): Promise<GoalTask> {
  return request<GoalTask>("/tasks", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteTask(id: string): Promise<{ deleted_task_id: string }> {
  return request<{ deleted_task_id: string }>(`/tasks/${id}`, { method: "DELETE" });
}

export async function deleteSubgoal(
  id: string,
): Promise<{ deleted_subgoal_id: string; tasks_removed: number }> {
  return request<{ deleted_subgoal_id: string; tasks_removed: number }>(
    `/subgoals/${id}`,
    { method: "DELETE" },
  );
}

export async function deleteGoal(id: string): Promise<{ deleted_goal_id: string }> {
  return request<{ deleted_goal_id: string }>(`/goals/${id}`, { method: "DELETE" });
}

export async function removeFromSchedule(
  date: string,
  task_ref_id: string,
): Promise<void> {
  await request(`/schedule/task`, {
    method: "DELETE",
    body: JSON.stringify({ date, task_ref_id }),
  });
}

/** Completes today's challenge — the API matches by date, not id. */
export async function completeChallenge(): Promise<XpResult> {
  const today = new Date().toISOString();
  const data = await request<{ xp_result: RawXpResult }>(
    `/challenges/complete/${encodeURIComponent(today)}`,
    { method: "POST" },
  );
  return data.xp_result;
}

// ---------------------------------------------------------------------------
// Workout
// ---------------------------------------------------------------------------

export interface TodayWorkoutExercise {
  name: string;
  sets: number;
  reps: string;
  rest_seconds?: number;
  notes?: string;
  exercise_type?: "weighted" | "bodyweight" | "cardio";
}

export interface TodayWorkout {
  day_name: string;
  is_rest_day: boolean;
  program_name: string;
  session: {
    session_type: string;
    exercises: TodayWorkoutExercise[];
  } | null;
}

export async function fetchTodayWorkout(): Promise<TodayWorkout> {
  return request<TodayWorkout>("/workout/today");
}

// ---------------------------------------------------------------------------
// Weekly Review
// ---------------------------------------------------------------------------

export interface WeeklyReview {
  week_start: string;
  week_end: string;
  xp_earned: number;
  xp_by_pillar: Record<string, number>;
  tasks_completed: number;
  tasks_scheduled: number;
  streak: { current_streak: number; longest_streak: number } | null;
  achievements: Array<{
    _id: string;
    title: string;
    xp_reward: number;
    triggered_at: string;
  }>;
  debuffs: Array<{ pillar: string; status: string; xp_multiplier: number }>;
  nudge: string;
  running_actual_km: number;
  running_target_km: number | null;
}

export async function fetchWeeklyReview(weekOffset = 0): Promise<WeeklyReview> {
  return request<WeeklyReview>(`/review/weekly?week_offset=${weekOffset}`);
}

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

export interface AchievementItem {
  _id: string;
  pillar_id?: string;
  title: string;
  description?: string;
  xp_reward: number;
  trigger_type: string;
  trigger_metric: string;
  trigger_value: number;
  is_triggered: boolean;
  triggered_at?: string;
}

export async function fetchAchievements(): Promise<AchievementItem[]> {
  return request<AchievementItem[]>("/achievements");
}

export async function upsertAchievements(
  achievements: Partial<AchievementItem>[],
): Promise<AchievementItem[]> {
  return request<AchievementItem[]>("/settings/achievements", {
    method: "PATCH",
    body: JSON.stringify({ achievements }),
  });
}

// ---------------------------------------------------------------------------
// Pillars
// ---------------------------------------------------------------------------

export async function fetchPillars(): Promise<Pillar[]> {
  return request<Pillar[]>("/pillars");
}

export async function createPillar(data: {
  name: string;
  color: string;
}): Promise<Pillar> {
  return request<Pillar>("/pillars", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ---------------------------------------------------------------------------
// Settings — XP config & rank definitions
// ---------------------------------------------------------------------------

export interface AppSettings {
  xp_config: Record<string, number>;
  bonus_config: Record<string, number>;
}

export interface RankDef {
  _id?: string;
  pillar_id?: string | null;
  rank_name: string;
  tier: 1 | 2 | 3;
  xp_required: number;
  display_order: number;
}

export async function fetchSettings(): Promise<AppSettings> {
  return request<AppSettings>("/settings");
}

export async function fetchRankDefs(): Promise<{
  ranks: RankDef[];
  pillars: Array<{ _id: string; name: string; color: string }>;
}> {
  return request("/settings/ranks");
}

export async function updateXpConfig(
  config: Record<string, number>,
): Promise<AppSettings> {
  return request<AppSettings>("/settings/xp", {
    method: "PATCH",
    body: JSON.stringify(config),
  });
}

export async function updateRanks(ranks: RankDef[]): Promise<RankDef[]> {
  return request<RankDef[]>("/settings/ranks", {
    method: "PATCH",
    body: JSON.stringify({ ranks }),
  });
}
