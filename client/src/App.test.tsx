import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Trip } from "@trip-planner/shared";

const mocks = vi.hoisted(() => ({
  me: vi.fn(),
  login: vi.fn(),
  setUser: vi.fn(),
  trips: vi.fn(),
  currentTrip: vi.fn(),
  logout: vi.fn(),
  selectTrip: vi.fn(),
  createTrip: vi.fn(),
  importTrips: vi.fn(),
  exportTrips: vi.fn(),
  createActivity: vi.fn(),
  updateActivity: vi.fn(),
  deleteActivity: vi.fn()
}));

vi.mock("./api", () => ({ api: mocks }));
vi.mock("./components/TripMap", () => ({ TripMap: () => <div>Map ready</div> }));
vi.mock("./components/CalendarTimeline", () => ({ CalendarTimeline: () => <div>Calendar ready</div> }));
vi.mock("./components/ActivityEditor", () => ({
  ActivityEditor: () => <div role="dialog">Activity editor ready</div>
}));
vi.mock("./components/ActivityBrowser", () => ({
  ActivityBrowser: () => <div role="dialog">Activity browser ready</div>
}));

import { App } from "./App";

const trip: Trip = {
  id: "trip",
  title: "Porto Weekend",
  startDate: "2026-09-19",
  endDate: "2026-09-21",
  timezone: "Europe/Lisbon",
  currency: "EUR",
  activities: []
};

describe("authenticated application workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.me.mockRejectedValue(new Error("not authenticated"));
    mocks.login.mockResolvedValue({ username: "admin", csrfToken: "token" });
    mocks.trips.mockResolvedValue({
      trips: [{ id: trip.id, title: trip.title, startDate: trip.startDate, endDate: trip.endDate, activityCount: 0 }],
      currentTripId: trip.id
    });
    mocks.currentTrip.mockResolvedValue(trip);
  });

  it("starts at login and reaches the protected activity workflow", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("heading", { name: "Trip Planner" });
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("heading", { name: "Porto Weekend" })).toBeVisible();
    expect(screen.getByText("Map ready")).toBeVisible();
    const activitiesMenu = screen.getByRole("button", { name: /activities/i });
    await user.click(activitiesMenu);
    await user.click(within(activitiesMenu.parentElement!).getByRole("button", { name: /new activity/i }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Activity editor ready");
  });
});
