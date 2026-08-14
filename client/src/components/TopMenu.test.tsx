import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { TopMenu } from "./TopMenu";

describe("TopMenu", () => {
  it("supports click, Escape, and Arrow Down keyboard behavior", async () => {
    const user = userEvent.setup();
    render(
      <TopMenu label="Activities">
        <button>New activity</button>
        <button>Browse activities</button>
      </TopMenu>
    );
    const trigger = screen.getByRole("button", { name: /activities/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: /new activity/i })).toBeVisible();
    await user.keyboard("{Escape}");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });
});
