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
  ] as const)("styles the %s variant with design.md tokens", (variant, expected) => {
    expect(buttonVariants({ variant }).split(" ")).toEqual(expect.arrayContaining([...expected]));
    expect(buttonVariants({ variant }).split(" ")).not.toContain("bg-primary");
  });

  it("keeps the 44px target on the small size and narrows the padding", () => {
    const classes = buttonVariants({ size: "sm" }).split(" ");
    expect(classes).toEqual(expect.arrayContaining(["min-h-11", "px-3"]));
    expect(classes).not.toContain("px-4");
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
});
