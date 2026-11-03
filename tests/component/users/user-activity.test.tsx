import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { UserActivity } from "@/components/users/user-activity";

const USER_ID = "00000000-0000-4000-8000-000000000002";
const ADMIN_ID = "00000000-0000-4000-8000-000000000001";

describe("UserActivity", () => {
  it("labels changes to the account and actions the account took", () => {
    render(
      <UserActivity
        userId={USER_ID}
        entries={[
          {
            id: "a1",
            action: "user.role_change",
            actorProfileId: ADMIN_ID,
            targetType: "user",
            targetId: USER_ID,
            reason: "Promoted",
            createdAt: "2026-10-03T02:00:00Z",
          },
          {
            id: "a2",
            action: "department.update",
            actorProfileId: USER_ID,
            targetType: "department",
            targetId: "dept-1",
            reason: null,
            createdAt: "2026-10-02T02:00:00Z",
          },
        ]}
      />,
    );

    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Role changed");
    expect(items[0]).toHaveTextContent("Reason: Promoted");
    expect(items[1]).toHaveTextContent("department.update");
    expect(items[1]).toHaveTextContent("By this account");
  });

  it("says when there is no activity", () => {
    render(<UserActivity userId={USER_ID} entries={[]} />);
    expect(screen.getByText("No recorded activity yet.")).toBeInTheDocument();
  });
});
