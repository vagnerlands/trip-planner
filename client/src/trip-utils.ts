import type { Activity } from "@trip-planner/shared";

export function addDays(date: string, amount: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

export function daysBetween(start: string, end: string): number {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000);
}

export function dateRange(start: string, end: string): string[] {
  return Array.from({ length: Math.max(0, daysBetween(start, end) + 1) }, (_, index) => addDays(start, index));
}

export function weekday(date: string): string {
  return new Intl.DateTimeFormat(undefined, { weekday: "short", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`)
  );
}

export function shortDate(date: string): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`)
  );
}

export function minutes(time: string): number {
  const [hours = 0, minute = 0] = time.split(":").map(Number);
  return hours * 60 + minute;
}

export function activitiesConflict(activities: Activity[]): boolean {
  const intervals = activities
    .map((activity) => ({
      start: minutes(activity.suggestedTime),
      end: minutes(activity.suggestedTime) + activity.durationMinutes
    }))
    .sort((a, b) => a.start - b.start);
  let latestEnd = -1;
  for (const interval of intervals) {
    if (interval.start < latestEnd) return true;
    latestEnd = Math.max(latestEnd, interval.end);
  }
  return false;
}

export function formatDuration(value: number): string {
  if (value < 60) return `${value}m`;
  const hours = Math.floor(value / 60);
  const remaining = value % 60;
  return remaining ? `${hours}h ${remaining}m` : `${hours}h`;
}
