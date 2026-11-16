import { Badge } from "@/components/ui/badge";
import type { AnalyticsSummary as Summary, SummaryPoint } from "@/lib/analytics/interpretation";

const SEVERITY_BADGE: Record<SummaryPoint["severity"], { tone: "danger" | "warning"; label: string }> = {
  alert: { tone: "danger", label: "Alert" },
  watch: { tone: "warning", label: "Watch" },
};

/**
 * ADM-17 Summary card: the most important chart interpretations (at most 3,
 * most severe first), each with a text severity badge and a link to its chart.
 * `chartPath` is the page holding the charts when it is not this one.
 */
export function AnalyticsSummary({ summary, chartPath = "" }: { summary: Summary; chartPath?: string }) {
  return (
    <section
      aria-labelledby="analytics-summary-title"
      className="rounded-xl border border-line bg-surface p-6 shadow-soft"
    >
      <h2 id="analytics-summary-title" className="mb-3 text-lg font-semibold text-ink">
        Summary
      </h2>
      {"message" in summary ? (
        <p className="text-sm text-ink-secondary">{summary.message}</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {summary.points.map((point) => (
            <li key={point.chartId} className="flex items-start gap-2.5 text-sm">
              <Badge tone={SEVERITY_BADGE[point.severity].tone}>{SEVERITY_BADGE[point.severity].label}</Badge>
              <a
                href={`${chartPath}#${point.chartId}`}
                className="rounded text-ink underline-offset-2 focus-ring hover:text-primary hover:underline"
              >
                {point.text}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
