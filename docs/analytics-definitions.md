# Analytics metric definitions (ADM-10, D5) — v3

v1 frozen on 2026-11-05. **v2 approved by the owner on 2026-11-08** to match the
redesigned analytics page (the reference design's datasets, computed from real
data). **v3 approved on 2026-11-16** (ADM-17): adds the interpretation
thresholds, minimums, and severity rules below; no metric changed. Every number on `/admin/analytics` (ADM-11) and the admin dashboard
(ADM-12) comes from `src/lib/analytics/metrics.ts`, which implements this page.
Change both together, and get sign-off first.

## Period and cohort

- A period is `[from, to)` in Manila calendar dates (`Asia/Manila`, UTC+8, no DST). `to` is excluded. The page opens on **this year** (Jan 1 – Dec 31, Manila).
- Unless stated otherwise, the cohort is every appointment whose `scheduled_at` falls in the period. A creation date is never used as a scheduled date.
- Doctor and department filters narrow every metric. A department filter selects that department's doctors.
- Every cohort holds doctor consultations only (`appointments.kind = 'consultation'`). Lab, imaging, and package visits (PAY-07, no doctor) are left out, so no metric changed; how to count them is for PAY-08 and needs the owner's sign-off.

## Metrics

| Metric | Definition |
|---|---|
| Total | Appointments in the cohort with status ≠ `rejected`. |
| Outcome cohort (finished visits) | Cohort rows whose `scheduled_end_at` is before now and whose status is `completed`, `cancelled`, or `no_show`. Replaces v1's due cohort; confirmation evidence is no longer needed. |
| Completion rate | `completed` ÷ outcome cohort. |
| Cancellation rate | `cancelled` ÷ outcome cohort (any cancellation of a finished visit). |
| No-show rate | `no_show` ÷ outcome cohort. |
| Outcome months | First to last Manila month with outcome-cohort rows (e.g. "Jan–Jun"). Labels the outcome KPIs and the outcomes chart. |
| Busiest month | Month with the highest Total; ties go to the earliest. |
| Peak slot | Weekday × daytime slot with the highest Total; ties go to the earliest weekday, then the earliest slot. |
| Pending | Current count of `requested` (shown as "Pending confirmation"). A snapshot that ignores the period but respects the doctor and department filters. |
| Cancellation date | `created_at` of the `cancelled` audit row (latest one). Used by ADM-12's Cancelled card (D4). No `cancelled_at` column exists. |

Rates are percentages rounded to 2 decimals (the page shows 1), and they are `null` (not 0) when the outcome cohort is empty. Completed + cancelled + no-show always equals the outcome cohort.

## Rules (§13.4)

- Pending is never counted as completed, and pending, confirmed, checked-in, or rejected appointments never enter the outcome cohort.
- Rejected requests are excluded from every rate and every volume count.
- Notification data is never used.

## Buckets

- Month: the Manila `YYYY-MM` of `scheduled_at`. Monthly volume lists every month the period touches, with empty months as 0.
- Weekday: Manila weekday, Monday first.
- Daytime slot: by Manila start hour — `9–11 AM` (09:00–10:59), `11 AM–1 PM`, `1–3 PM`, `3–5 PM` (15:00–16:59). Starts outside 09:00–16:59 are counted as "outside clinic hours".

## Datasets

| Dataset | Shape | Basis |
|---|---|---|
| KPIs | total, outcome cohort with completed/cancelled/no-show counts and rates, outcome months, busiest month, peak slot, pending | as above |
| Monthly volume | month → total | Total per month |
| By doctor | doctor → total, short name, outcome cohort, cancellation and no-show rates | sorted by total desc, then name; short name is the surname, with the first initial when surnames repeat |
| Heatmap | weekday × daytime slot → total, plus the outside-hours count | Mon–Fri always; Sat/Sun only when they have daytime appointments |
| Outcomes by month | month → completed, cancelled, no-show | outcome cohort, from the first to the last outcome month |
| Rates by weekday | weekday → outcome cohort, cancellation and no-show rates | only weekdays with outcomes |

Chart takeaways (`src/lib/analytics/takeaways.ts`) restate these datasets in one sentence each and never claim a cause.

## Dashboard (ADM-12)

Added on 2026-11-08. The admin dashboard (`/admin`) reuses the definitions above.

| Card or section | Definition |
|---|---|
| Total appointments | Total (as above) for the selected range. |
| Pending requests | Pending snapshot (as above), respecting the doctor and department filters. |
| Confirmed, Completed, No-show | Cohort rows whose **current** status is `confirmed`, `completed`, or `no_show`. |
| Cancelled | Appointments now `cancelled` whose cancellation date (the `cancelled` audit row's `created_at`) is in the range, whatever their scheduled date (D4). |
| Trend | `(total − previous total) ÷ previous total`, as a percentage rounded to 2 decimals; `null` when the previous total is 0. The previous period is the equal-length window ending where the range starts (this week → the previous Monday–Sunday). |
| Appointment activity | Total per Manila day of `scheduled_at`, every day in the range, empty days as 0. |
| Status distribution | Cohort rows per current status, except `rejected`. |
| Doctor performance | The first 5 rows of "By doctor". |
| Front desk queue | Current `requested` count, the oldest request's `created_at`, and the count per department. |

Range presets: Today, This week (Manila Monday–Sunday), This month, and Custom (inclusive dates, up to 24 months). There is no status filter.

## Interpretation (ADM-17, v3)

Added on 2026-11-16. Each chart on `/admin/analytics` gets a "What it means" line (at most 12 words), and the page and the admin dashboard show a Summary card (at most 3 points of at most 15 words). Both come from `src/lib/analytics/interpretation.ts`, with the constants in `interpretation-thresholds.ts`: fixed templates over the chart's own filtered dataset, no LLM. Lines state meaning, never a cause, and never mention a patient.

| Chart | Minimum (else "Not enough data yet to interpret.") | Bands → severity |
|---|---|---|
| Monthly volume | 2 months with appointments and ≥ 20 in total | last ÷ first month with appointments ≥ 1.2: growing (watch); ≤ 0.8: falling (alert); otherwise steady (ok) |
| Load by doctor | 2 doctors with ≥ 5 appointments each; only those doctors are compared | busiest ÷ quietest ≥ 2: uneven, names the busiest (alert); ≥ 1.3: somewhat uneven (watch); otherwise balanced (ok) |
| Peak heatmap | ≥ 30 appointments in the shown cells | busiest cell ≥ 2× the average shown cell: clear rush hour (watch); otherwise evenly spread (ok). Ties go to the earliest weekday, then slot |
| Outcomes | ≥ 20 finished visits | missed (cancelled + no-show) share ≥ 20%: high, "about 1 in N", N = round(1 ÷ share) (alert); ≥ 10%: moderate (watch); otherwise low (ok) |
| Weekday rates | ≥ 20 finished visits | worst weekday's missed rate ≥ 1.5× the period's missed rate (all finished visits): that weekday stands out (alert); otherwise none (ok) |
| Doctor rates | ≥ 20 finished visits | worst doctor's missed rate ≥ 1.5× the period's missed rate: names that doctor (alert); otherwise similar (ok) |

Summary card: alert points first, then watch, each in chart order, at most 3, each prefixed with the chart's label (Volume, Doctors, Peak times, Outcomes, Weekdays, Doctor rates). Nothing alert or watch: "Everything looks steady for this period." No chart meets its minimum: "Not enough data yet to interpret this period." The dashboard computes the same interpretations from its own range's rows, and its points link to the analytics charts for the same dates and filters. The CSV export is unchanged.
