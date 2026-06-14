/** Date helpers — all boundaries computed in server local time. */

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Returns the current time. Set FAKE_NOW in .env to override for testing (e.g. FAKE_NOW=2025-01-03T12:00:00). */
export function getNow(): Date {
  return process.env.FAKE_NOW ? new Date(process.env.FAKE_NOW) : new Date();
}

export function startOfToday(now = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfToday(now = new Date()): Date {
  const d = new Date(now);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Whole calendar days between two dates (ignoring time-of-day). */
export function daysBetween(from: Date, to: Date): number {
  return Math.floor((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY);
}

export function daysAgo(n: number, now = new Date()): Date {
  return new Date(now.getTime() - n * MS_PER_DAY);
}

export function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

/** Monday-based start of the week containing `now`, at 00:00:00. */
export function startOfWeek(now = new Date()): Date {
  const d = startOfToday(now);
  const day = d.getDay(); // 0 = Sun
  const diff = (day + 6) % 7; // days since Monday
  d.setDate(d.getDate() - diff);
  return d;
}

export function endOfWeek(now = new Date()): Date {
  const start = startOfWeek(now);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}
