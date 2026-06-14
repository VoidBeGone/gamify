/** String-based date helpers — avoids UTC-vs-local off-by-one issues. */

export function toDateString(date: Date | string): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayString(): string {
  return toDateString(new Date());
}

export function getWeekStart(date?: Date): string {
  const d = date ? new Date(date) : new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  const monday = new Date(d.setDate(diff));
  return toDateString(monday);
}

export function getWeekEnd(date?: Date): string {
  const weekStart = new Date(getWeekStart(date));
  const sunday = new Date(weekStart);
  sunday.setDate(sunday.getDate() + 6);
  return toDateString(sunday);
}
