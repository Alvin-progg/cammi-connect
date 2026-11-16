import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HmoProviderForm } from "@/components/hmo-providers/hmo-provider-form";
import { HmoProviderStatusForm } from "@/components/hmo-providers/hmo-provider-status";
import { HmoProvidersTable } from "@/components/hmo-providers/hmo-providers-table";
import type { HmoProvider } from "@/lib/hmo-providers/types";

vi.mock("@/server/hmo-providers/actions", () => ({
  saveHmoProviderAction: vi.fn(),
  setHmoProviderActiveAction: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

const MAXICARE: HmoProvider = {
  id: "00000000-0000-4000-8000-000000000a01",
  name: "Maxicare",
  copayCentavos: 15000,
  notes: "Synthetic sample.",
  isActive: true,
};

describe("HmoProvidersTable", () => {
  it("lists providers with co-pay and status", () => {
    render(
      <HmoProvidersTable
        providers={[
          MAXICARE,
          { ...MAXICARE, id: "00000000-0000-4000-8000-000000000a09", name: "Retired HMO", copayCentavos: 0, isActive: false },
        ]}
      />,
    );

    const rows = within(screen.getByRole("table", { name: "HMO providers" })).getAllByRole("row");
    expect(within(rows[1]).getByRole("link", { name: "Maxicare" })).toHaveAttribute(
      "href",
      `/admin/hmo-providers/${MAXICARE.id}`,
    );
    expect(rows[1]).toHaveTextContent("₱150.00");
    expect(rows[1]).toHaveTextContent("Active");
    expect(rows[2]).toHaveTextContent("None");
    expect(rows[2]).toHaveTextContent("Inactive");
  });

  it("shows an empty state", () => {
    render(<HmoProvidersTable providers={[]} />);
    expect(screen.getByText("No HMO providers yet.")).toBeInTheDocument();
  });
});

describe("HmoProviderForm", () => {
  it("edits name, co-pay in pesos, and notes", () => {
    render(<HmoProviderForm provider={MAXICARE} />);
    expect(screen.getByLabelText("Name")).toHaveValue("Maxicare");
    expect(screen.getByLabelText("Co-pay (₱)")).toHaveValue("150.00");
    expect(screen.getByLabelText("Notes")).toHaveValue("Synthetic sample.");
    expect(screen.getByRole("button", { name: "Save HMO provider" })).toBeInTheDocument();
  });

  it("creates a new provider", () => {
    render(<HmoProviderForm />);
    expect(screen.getByLabelText("Co-pay (₱)")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Create HMO provider" })).toBeInTheDocument();
  });
});

describe("HmoProviderStatusForm", () => {
  it("offers the opposite of the current status", () => {
    const { unmount } = render(<HmoProviderStatusForm provider={MAXICARE} />);
    expect(screen.getByRole("button", { name: "Deactivate HMO provider" })).toBeInTheDocument();
    unmount();
    render(<HmoProviderStatusForm provider={{ ...MAXICARE, isActive: false }} />);
    expect(screen.getByRole("button", { name: "Activate HMO provider" })).toBeInTheDocument();
  });
});
