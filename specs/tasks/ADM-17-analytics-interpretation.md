# ADM-17 — Short Data-Based Interpretation on Admin Analytics

- Status: **Built** 2026-11-16 (approved the same day by the project owner, I1–I4 at their recommended defaults)
- Type: Feature
- Module: Administrator / Analytics (`/admin/analytics`)
- Builds on: ADM-10 metric layer, ADM-11 analytics page, `src/lib/analytics/takeaways.ts`
- Amends: `docs/analytics-definitions.md` (adds interpretation thresholds; definitions v2 →
  v3)

## Objective

Each chart already has a **takeaway**: one sentence that restates the numbers ("Volume rose
from August (40) to October (85)"). Admins also need to know **what it means**, in a few
words, without reading the chart closely.

Add:

1. A **"What it means"** line under each chart's takeaway: **≤ 12 words**.
2. A **Summary** card at the top of the page: the **3 most important** points across all
   charts, **≤ 15 words each**.

## Rules

- **Only from the data on screen.** Every interpretation is computed from the same filtered
  datasets the charts use. Change the filters and the interpretation changes with them.
- **Deterministic, not AI.** Fixed thresholds and templates in pure TypeScript
  (`src/lib/analytics/interpretation.ts`). No LLM call: an LLM could state numbers or
  causes the data doesn't show, can't be unit-tested, and would send hospital data to a
  provider. The same data always gives the same words.
- **Meaning, never a cause.** Say what the numbers mean ("demand is growing", "higher than
  usual"), never why ("because of the rainy season"). Banned words: *because*, *due to*,
  *caused*, *since* (as a reason).
- **Compare to something.** Each line compares against the period's own average, the
  first vs last month, or a fixed threshold. No bare adjectives.
- **Say nothing when data is thin.** Below the minimums, show "Not enough data yet to
  interpret." instead of a guess.
- **Really short.** Hard limits enforced by tests: 12 words per chart line, 15 words per
  summary point, 3 summary points max.
- **No patient data.** Doctor names may appear (they already do in takeaways); patients
  never.

## Minimum data before interpreting

| Chart | Minimum |
|---|---|
| Monthly volume | 2 months with appointments and ≥ 20 appointments total |
| Load by doctor | 2 doctors with ≥ 5 appointments each |
| Peak heatmap | ≥ 30 appointments |
| Outcomes, weekday rates, doctor rates | ≥ 20 finished visits (the existing outcome cohort) |

## Interpretation per chart

Thresholds are named constants, documented in `analytics-definitions.md` v3.

| Chart | Condition | "What it means" (template) |
|---|---|---|
| Monthly volume | last ÷ first ≥ 1.2 | Demand is growing; watch doctor capacity. |
| | ≤ 0.8 | Demand is falling compared with {first month}. |
| | otherwise | Demand is steady. |
| Load by doctor | busiest ÷ quietest ≥ 2 | Workload is uneven; {busiest} is carrying the most. |
| | 1.3–2 | Workload is somewhat uneven. |
| | < 1.3 | Workload is balanced across doctors. |
| Peak heatmap | peak ≥ 2× average cell | {Weekday} {slot} is the clear rush hour. |
| | otherwise | Visits are spread fairly evenly through the week. |
| Outcomes | missed share ≥ 20% | High: about 1 in {N} visits is lost. |
| | 10–20% | Moderate share of visits lost. |
| | < 10% | Low: most patients show up. |
| Weekday rates | worst day ≥ 1.5× average | {Weekday}s lose the most visits; reminders matter most then. |
| | otherwise | No weekday stands out for missed visits. |
| Doctor rates | worst ≥ 1.5× average | {Doctor}'s patients miss visits most often. |
| | otherwise | Missed visits are similar across doctors. |

`{N}` = `round(1 / missed share)`, for example 25% → "1 in 4".

Example, under the existing takeaway:

> Volume more than doubled from August (40) to October (85).
> **What it means:** Demand is growing; watch doctor capacity.

## Summary card

- Each interpretation gets a severity: **alert** (thresholds marked high/uneven/falling/
  stands out), **watch** (moderate/somewhat), or **ok**.
- The card shows up to 3 points: alerts first, then watch, in chart order. If nothing is
  alert or watch, it shows one line: "Everything looks steady for this period."
- Each point is the chart's interpretation, prefixed with the chart name, ≤ 15 words:
  - "Outcomes: about 1 in 4 visits is lost."
  - "Doctors: workload is uneven; Dr. Santos carries the most."
  - "Volume: demand is growing; watch doctor capacity."
- Severity is shown with a small badge (text label, not color alone), using existing Calm
  Care tokens.
- Each point links to its chart (`#chart-id`).
- Thin data: the card says "Not enough data yet to interpret this period." when no chart
  meets its minimum.

## Where it shows

- `/admin/analytics`: ~~Summary card above the KPIs~~ removed 2026-11-24 (owner request); "What it means" under each takeaway stays.
- `/admin` dashboard: ~~the same Summary card (top 3)~~ removed 2026-11-24 (owner request; the dashboard already has Needs attention). Summary stays on `/admin/analytics` only.
- CSV export: unchanged (data only).

## Files

| File | Change |
|---|---|
| `src/lib/analytics/interpretation.ts` *(new, pure)* | One function per chart → `{ text, severity } \| null`; `summarize(...)` → top 3 |
| `src/lib/analytics/interpretation-thresholds.ts` *(new)* | Named threshold and minimum constants |
| `src/components/analytics/chart-card.tsx` | Renders the "What it means" line |
| `src/components/analytics/analytics-summary.tsx` *(new)* | Summary card |
| `src/app/admin/analytics/page.tsx` | Computes and passes interpretations |
| `docs/analytics-definitions.md` | v3: thresholds, minimums, severity rules |

No migration, no new dependency, no new data read.

## Tests (write first)

- Each chart: one test per threshold band, plus exactly-on-the-boundary cases, plus
  below-minimum → null.
- Word limits: every template, filled with the longest realistic doctor name and month,
  stays within 12 / 15 words.
- Banned-word test across all templates (*because*, *due to*, *caused*).
- Summary: alerts sort before watch; max 3; all-ok → steady line; all-thin → not-enough
  line.
- Same input twice → identical output.
- Component: Summary card renders badges with text labels and links to chart anchors.

## Acceptance criteria

- [x] Every chart shows a ≤ 12-word "What it means" line built only from its data.
- [x] The Summary card shows at most 3 points, ≤ 15 words each, most severe first.
- [x] Changing filters changes the interpretations.
- [x] Thin data shows "Not enough data yet" instead of an interpretation.
- [x] No interpretation states a cause or mentions a patient.
- [x] No LLM or external call is made to produce interpretations.

## Decisions (approved 2026-11-16)

The project owner approved every recommended default below.

| # | Decision | Approved |
|---|---|---|
| I1 | Rule-based templates instead of AI-written text | Yes (reasons above) |
| I2 | Thresholds and minimums in the tables above | Approve as listed; tune after real data |
| I3 | Light suggestions allowed ("watch doctor capacity", "reminders matter most then") | Yes, only these fixed phrases, never new advice |
| I4 | Show the Summary card on the `/admin` dashboard too | Yes (superseded 2026-11-24: Summary card removed from `/admin` and `/admin/analytics` by owner request) |
