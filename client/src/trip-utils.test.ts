import type { Activity } from "@trip-planner/shared";
import { describe, expect, it } from "vitest";
import { activitiesConflict, dateRange, daysBetween } from "./trip-utils";

function activity(id: string, time: string, durationMinutes: number): Activity {
  return {
    id,
    date: "2026-09-14",
    suggestedTime: time,
    title: id,
    description: "",
    observations: "",
    location: { latitude: 0, longitude: 0 },
    durationMinutes,
    tags: []
  };
}

describe("trip calendar helpers", () => {
  it("creates inclusive ISO date ranges", () => {
    expect(dateRange("2026-09-14", "2026-09-16")).toEqual(["2026-09-14", "2026-09-15", "2026-09-16"]);
    expect(daysBetween("2026-09-14", "2026-09-16")).toBe(2);
  });

  it("allows back-to-back activities but detects genuine overlap", () => {
    expect(activitiesConflict([activity("a", "09:00", 60), activity("b", "10:00", 30)])).toBe(false);
    expect(activitiesConflict([activity("a", "09:00", 61), activity("b", "10:00", 30)])).toBe(true);
  });
});
