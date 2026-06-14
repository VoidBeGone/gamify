/** String-based date helpers — always UTC so comparisons are timezone-independent. */

export function toDateString(date: Date | string): string {
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayString(): string {
  return toDateString(new Date());
}

export function getWeekStart(date?: Date): string {
  const d = date ? new Date(date) : new Date();
  const dayOfWeek = d.getUTCDay(); // 0=Sun, 1=Mon … 6=Sat
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
  monday.setUTCHours(0, 0, 0, 0);
  return toDateString(monday);
}

export function getWeekEnd(date?: Date): string {
  const sunday = new Date(getWeekStart(date) + 'T00:00:00.000Z');
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  return toDateString(sunday);
}
