import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { VerifiedBenefitBadges } from "@/components/benefits/verified-benefit-badges";

describe("VerifiedBenefitBadges", () => {
  it("shows a badge only for each verified benefit", () => {
    render(<VerifiedBenefitBadges pwdVerified hmoVerified={false} />);
    expect(screen.getByText("PWD verified")).toBeInTheDocument();
    expect(screen.queryByText("HMO verified")).not.toBeInTheDocument();
  });

  it("renders nothing when no benefit is verified", () => {
    const { container } = render(<VerifiedBenefitBadges pwdVerified={false} hmoVerified={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});
