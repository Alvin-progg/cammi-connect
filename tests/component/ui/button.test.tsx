import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button, buttonVariants } from "@/components/ui/button";

describe("buttonVariants", () => {
  it("defaults to a 44px primary button", () => {
    const classes = buttonVariants().split(" ");
    expect(classes).toEqual(
      expect.arrayContaining([
        "focus-ring",
        "pressable",
        "min-h-11",
        "px-4",
        "border-primary",
        "bg-primary",
        "text-primary-ink",
        "hover:bg-primary-hover",
        "disabled:pointer-events-none",
      ]),
    );
  });

  it.each([
    ["secondary", ["border-line-strong", "bg-surface", "text-primary", "hover:bg-primary-soft"]],
    ["ghost", ["border-transparent", "bg-transparent", "text-ink", "hover:bg-surface-muted"]],
    ["danger", ["border-danger", "bg-danger", "text-danger-ink", "hover:bg-danger-hover"]],
    ["outlineDanger", ["border-line-strong", "bg-surface", "text-danger", "hover:bg-danger-soft"]],
    ["outline", ["border-line-strong", "bg-surface", "text-ink", "hover:bg-surface-muted"]],
    ["link", ["border-transparent", "bg-transparent", "text-primary"]],
  ] as const)("styles the %s variant with design.md tokens", (variant, expected) => {
    expect(buttonVariants({ variant }).split(" ")).toEqual(expect.arrayContaining([...expected]));
    expect(buttonVariants({ variant }).split(" ")).not.toContain("bg-primary");
  });

  // Redesign decision: `sm` is a 36px control for dense staff screens;
  // `md` and `lg` keep the 44px patient-facing target.
  it("uses a 36px compact small size and keeps 44px on md and lg", () => {
    const small = buttonVariants({ size: "sm" }).split(" ");
    expect(small).toEqual(expect.arrayContaining(["h-9", "px-3"]));
    expect(small).not.toContain("px-4");
    expect(buttonVariants({ size: "lg" }).split(" ")).toEqual(expect.arrayContaining(["min-h-11", "px-6"]));
  });

  it("appends extra classes", () => {
    expect(buttonVariants({ className: "w-full" }).split(" ")).toContain("w-full");
  });
});

describe("Button", () => {
  it("renders a non-submitting button by default with the variant classes", () => {
    render(<Button variant="danger">Reject request</Button>);

    const button = screen.getByRole("button", { name: "Reject request" });
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveClass("bg-danger", "text-danger-ink");
  });

  it("passes through the type, disabled state, and other attributes", () => {
    render(
      <Button type="submit" disabled aria-busy className="w-full">
        Booking…
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Booking…" });
    expect(button).toHaveAttribute("type", "submit");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveClass("w-full", "bg-primary");
  });

  it("lets a passed className override a conflicting variant class", () => {
    render(<Button className="px-8">Wide</Button>);

    const button = screen.getByRole("button", { name: "Wide" });
    expect(button).toHaveClass("px-8");
    expect(button).not.toHaveClass("px-4");
  });
});
