/**
 * Parse an ISO date string as a LOCAL calendar date, bypassing the UTC→local
 * shift that causes UTC-midnight dates to display as the previous day in
 * negative-offset timezones (e.g. EDT = UTC-4).
 *
 * Use this for any date stored as a "calendar date" (scheduled_date, deadline,
 * week_start, week_end). For actual timestamps (logged_at, created_at) use
 * new Date() directly — the local-time display is correct there.
 */
export function parseCalDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, (m - 1), d);
}

export function fmtCalShort(iso: string): string {
  return parseCalDate(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function fmtCalLong(iso: string): string {
  return parseCalDate(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
