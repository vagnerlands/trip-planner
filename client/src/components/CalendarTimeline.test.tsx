import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Activity, Trip } from "@trip-planner/shared";
import { CalendarTimeline } from "./CalendarTimeline";

const base = { description: "", observations: "", location: { latitude: 1, longitude: 1 }, tags: [] };
const activities: Activity[] = [
  { ...base, id: "one", date: "2026-09-14", suggestedTime: "09:00", title: "Museum", durationMinutes: 90 },
  { ...base, id: "two", date: "2026-09-14", suggestedTime: "10:00", title: "Tour", durationMinutes: 60 }
];
const trip: Trip = {
  id: "trip",
  title: "Test",
  startDate: "2026-09-14",
  endDate: "2026-09-16",
  timezone: "UTC",
  currency: "USD",
  activities
};

describe("CalendarTimeline", () => {
  it("announces trip days and schedule conflicts without relying on color", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <CalendarTimeline trip={trip} activities={activities} from="2026-09-14" to="2026-09-14" onChange={onChange} />
    );
    const conflictDay = screen.getByRole("button", { name: /2026-09-14, activities with conflict, trip day 1/i });
    expect(conflictDay).toHaveClass("conflict");
    expect(screen.getByRole("button", { name: /museum.*overlaps tour/i })).toBeVisible();
    const openDay = screen.getByRole("button", { name: /2026-09-15, open, trip day 2/i });
    await user.click(openDay);
    expect(onChange).toHaveBeenCalledWith("2026-09-15", "2026-09-15");
  });
});
