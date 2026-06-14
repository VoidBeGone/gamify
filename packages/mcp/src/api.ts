/**
 * Typed HTTP client for the LevelUp backend REST API.
 *
 * Every backend response is wrapped in an envelope:
 *   { success: boolean, data: T, error?: string }
 *
 * The helpers below unwrap `data` on success and throw a descriptive `ApiError`
 * otherwise, so tool handlers can stay focused on formatting.
 */

const BASE_URL = (process.env.API_BASE_URL ?? 'http://localhost:3001/api/v1').replace(/\/$/, '');
const API_KEY = process.env.API_KEY;

/** Error carrying the HTTP status and the backend's error message. */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

interface Envelope<T> {
  success: boolean;
  data: T;
  error?: string;
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  if (!API_KEY) {
    throw new ApiError(500, 'API_KEY is not set — copy .env.example to .env and fill it in.');
  }

  const url = `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new ApiError(
      503,
      `Could not reach the backend at ${BASE_URL}. Is the API running? (${detail})`
    );
  }

  let payload: Envelope<T> | null = null;
  const raw = await res.text();
  if (raw) {
    try {
      payload = JSON.parse(raw) as Envelope<T>;
    } catch {
      // Non-JSON body (e.g. proxy error page) — surface the raw text.
      throw new ApiError(res.status, raw.slice(0, 300));
    }
  }

  if (!res.ok || (payload && payload.success === false)) {
    const message = payload?.error ?? `Request failed with status ${res.status}`;
    throw new ApiError(res.status, message);
  }

  return (payload ? payload.data : (undefined as T));
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string, body?: unknown) => request<T>('DELETE', path, body),
};

// ---------------------------------------------------------------------------
// Shared backend shapes (only the fields the MCP layer reads)
// ---------------------------------------------------------------------------

export interface Pillar {
  _id: string;
  name: string;
  color: string;
  xp: number;
  rank_name: string;
  rank_tier: number;
  neglect_status: 'healthy' | 'warning' | 'neglected' | 'critical';
  xp_multiplier: number;
  last_activity_date?: string;
}

export interface Streak {
  streak_type: string;
  current_streak: number;
  longest_streak: number;
  last_active_date?: string;
}

export interface MetricLatest {
  metric_type: string;
  value: number;
  secondary_value?: number;
  notes?: string;
  logged_at: string;
}

export interface MetricLog {
  _id: string;
  metric_type: string;
  value: number;
  secondary_value?: number;
  notes?: string;
  logged_at: string;
}

// ---------------------------------------------------------------------------
// Pillar resolution: the spec exposes pillars by friendly name, but the
// backend keys most things by ObjectId. These helpers bridge the two.
// ---------------------------------------------------------------------------

/** Canonical pillar names, exactly as created by the backend seed. */
export const PILLAR = {
  fitness: 'Fitness & Nutrition',
  content: 'Content Creation',
  sideQuests: 'Side Quests',
} as const;

const PILLAR_ALIASES: Record<string, string[]> = {
  [PILLAR.fitness]: ['fitness', 'nutrition', 'gym', 'workout', 'health', 'run', 'running', 'food'],
  [PILLAR.content]: ['content', 'instagram', 'insta', 'social', 'reel', 'reels', 'posting', 'creation'],
  [PILLAR.sideQuests]: ['side', 'quest', 'quests', 'sidequest', 'sidequests', 'adventure', 'toronto'],
};

/** Fetch all pillars (with refreshed debuff status). */
export function getPillars(): Promise<Pillar[]> {
  return api.get<Pillar[]>('/pillars');
}

/**
 * Resolve a user-supplied pillar reference (canonical name, partial name, or
 * alias) to the matching Pillar document. Throws a helpful error otherwise.
 */
export async function resolvePillar(input: string): Promise<Pillar> {
  const pillars = await getPillars();
  const needle = input.trim().toLowerCase();

  // Exact (case-insensitive) name match.
  let match = pillars.find((p) => p.name.toLowerCase() === needle);
  if (match) return match;

  // Substring match against the real names.
  match = pillars.find((p) => p.name.toLowerCase().includes(needle));
  if (match) return match;

  // Alias match.
  for (const [canonical, aliases] of Object.entries(PILLAR_ALIASES)) {
    if (aliases.some((a) => needle.includes(a))) {
      match = pillars.find((p) => p.name === canonical);
      if (match) return match;
    }
  }

  const available = pillars.map((p) => p.name).join(', ');
  throw new ApiError(404, `No pillar matches "${input}". Available pillars: ${available}.`);
}
