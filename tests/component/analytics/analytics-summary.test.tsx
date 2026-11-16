import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AnalyticsSummary } from "@/components/analytics/analytics-summary";
import { ChartCard } from "@/components/analytics/chart-card";

describe("AnalyticsSummary", () => {
  it("lists each point with a text severity badge and a link to its chart", () => {
    render(
      <AnalyticsSummary
        summary={{
          points: [
            { chartId: "outcomes", severity: "alert", text: "Outcomes: about 1 in 4 visits is lost." },
            { chartId: "monthly-volume", severity: "watch", text: "Volume: demand is growing; watch doctor capacity." },
          ],
        }}
      />,
    );

    const card = screen.getByRole("region", { name: "Summary" });
    const items = within(card).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText("Alert")).toBeInTheDocument();
    expect(within(items[0]).getByRole("link", { name: "Outcomes: about 1 in 4 visits is lost." })).toHaveAttribute(
      "href",
      "#outcomes",
    );
    expect(within(items[1]).getByText("Watch")).toBeInTheDocument();
    expect(within(items[1]).getByRole("link")).toHaveAttribute("href", "#monthly-volume");
  });

  it("prefixes chart links with another page's address", () => {
    render(
      <AnalyticsSummary
        summary={{ points: [{ chartId: "outcomes", severity: "alert", text: "Outcomes: about 1 in 4 visits is lost." }] }}
        chartPath="/admin/analytics?range=this_month"
      />,
    );

    expect(screen.getByRole("link")).toHaveAttribute("href", "/admin/analytics?range=this_month#outcomes");
  });

  it("shows a message instead of points", () => {
    render(<AnalyticsSummary summary={{ message: "Everything looks steady for this period." }} />);

    expect(screen.getByText("Everything looks steady for this period.")).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });
});

describe("ChartCard interpretation", () => {
  it("shows what the chart means under the takeaway", () => {
    render(
      <ChartCard
        id="outcomes"
        title="Outcomes"
        description="Takeaway."
        emptyMessage={null}
        interpretation={{ severity: "alert", text: "High: about 1 in 4 visits is lost.", point: "" }}
      >
        <div />
      </ChartCard>,
    );

    expect(screen.getByText("What it means:")).toBeInTheDocument();
    expect(screen.getByText("High: about 1 in 4 visits is lost.")).toBeInTheDocument();
  });

  it("says there is not enough data when the interpretation is null", () => {
    render(
      <ChartCard id="outcomes" title="Outcomes" description="Takeaway." emptyMessage={null} interpretation={null}>
        <div />
      </ChartCard>,
    );

    expect(screen.getByText("Not enough data yet to interpret.")).toBeInTheDocument();
  });

  it("shows no interpretation line when none is given or the chart is empty", () => {
    const { rerender } = render(
      <ChartCard id="daily" title="Daily" description="Takeaway." emptyMessage={null}>
        <div />
      </ChartCard>,
    );
    expect(screen.queryByText("What it means:")).not.toBeInTheDocument();

    rerender(
      <ChartCard id="daily" title="Daily" description="Takeaway." emptyMessage="Nothing yet." interpretation={null}>
        <div />
      </ChartCard>,
    );
    expect(screen.queryByText("What it means:")).not.toBeInTheDocument();
    expect(screen.queryByText("Not enough data yet to interpret.")).not.toBeInTheDocument();
  });
});
