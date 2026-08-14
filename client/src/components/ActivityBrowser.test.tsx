import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Activity } from "@trip-planner/shared";
import { ActivityBrowser } from "./ActivityBrowser";

const activity: Activity = {
  id: "one",
  date: "2026-09-14",
  suggestedTime: "09:00",
  title: "Art Museum",
  description: "Modern collection",
  observations: "",
  location: { latitude: 1, longitude: 1, address: "Center" },
  durationMinutes: 60,
  tags: ["culture"]
};

describe("ActivityBrowser", () => {
  it("searches current-trip activities and closes with Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <ActivityBrowser
        activities={[activity]}
        onClose={onClose}
        onSelect={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(screen.getByText("Art Museum")).toBeVisible();
    await user.type(screen.getByRole("searchbox"), "beach");
    expect(screen.getByText(/no activities match/i)).toBeVisible();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });
});
