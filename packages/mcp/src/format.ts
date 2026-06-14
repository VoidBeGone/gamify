/**
 * Helpers for turning data + errors into the `CallToolResult` shape the MCP
 * SDK expects, plus a few presentation utilities shared across tools.
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { ApiError } from './api.js';

/** A successful, human-readable tool result. */
export function textResult(text: string): CallToolResult {
  return { content: [{ type: 'text', text }] };
}

/** Map any thrown error to a clean, descriptive tool error result. */
export function errorResult(err: unknown): CallToolResult {
  let message: string;
  if (err instanceof ApiError) {
    message = `Backend error (${err.status}): ${err.message}`;
  } else if (err instanceof Error) {
    message = err.message;
  } else {
    message = String(err);
  }
  return { content: [{ type: 'text', text: `❌ ${message}` }], isError: true };
}

/**
 * Wrap an async tool body so any thrown error becomes a graceful error result.
 * Keeps every handler down to its happy path.
 */
export function tool<A>(fn: (args: A) => Promise<string>) {
  return async (args: A): Promise<CallToolResult> => {
    try {
      return textResult(await fn(args));
    } catch (err) {
      return errorResult(err);
    }
  };
}

// ---------------------------------------------------------------------------
// Presentation utilities
// ---------------------------------------------------------------------------

/** Format a pace in seconds-per-km as "m:ss /km". */
export function formatPace(secondsPerKm?: number): string {
  if (secondsPerKm == null || !Number.isFinite(secondsPerKm)) return '—';
  const min = Math.floor(secondsPerKm / 60);
  const sec = Math.round(secondsPerKm % 60);
  return `${min}:${sec.toString().padStart(2, '0')} /km`;
}

/** Format an ISO date as YYYY-MM-DD (or "—"). */
export function formatDate(iso?: string | Date | null): string {
  if (!iso) return '—';
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toISOString().slice(0, 10);
}

/** Whole days from now until `iso` (negative if past). */
export function daysUntil(iso?: string | Date | null): number | null {
  if (!iso) return null;
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.round((d.getTime() - Date.now()) / 86_400_000);
}
