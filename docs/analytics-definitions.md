# Analytics metric definitions (ADM-10, D5)

Frozen on 2026-11-05. Every number on `/admin/analytics` (ADM-11) and the admin
dashboard (ADM-12) comes from `src/lib/analytics/metrics.ts`, which implements
this page. Change both together, and get sign-off first.

## Period and cohort

- A period is `[from, to)` in Manila calendar dates (`Asia/Manila`, UTC+8, no DST). `to` is excluded.
- Unless stated otherwise, the cohort is every appointment whose `scheduled_at` falls in the period. A creation date is never used as a scheduled date.
- Doctor and department filters narrow every metric. A department filter selects that department's doctors.

## Metrics

| Metric | Definition |
|---|---|
| Total | Appointments in the cohort with status ≠ `rejected`. |
| Was confirmed | `confirmed_at` is set, OR an `appointment_audit_logs` row has `new_status = 'confirmed'`, OR the status is `checked_in`, `completed`, or `no_show`. The last case covers seed and pre-FD-001 rows that reached attendance with no recorded confirmation. |
| Due cohort | Cohort rows that were confirmed, have status in {`confirmed`, `checked_in`, `completed`, `no_show`, `cancelled`}, and have `scheduled_end_at` before now. |
| Completion rate | `completed` ÷ due cohort. |
| No-show rate | `no_show` ÷ due cohort. |
| Cancellation rate | `cancelled` ÷ due cohort. Because the cohort requires confirmation, this counts only cancellations after confirmation. |
| Pending | Current count of `requested` (shown as "Pending confirmation"). A snapshot that ignores the period but respects the doctor and department filters. |
| Cancellation date | `created_at` of the `cancelled` audit row (latest one). Used by ADM-12's Cancelled card (D4). No `cancelled_at` column exists. |

Rates are percentages rounded to 2 decimals, and they are `null` (not 0) when the due cohort is empty.

## Rules (§13.4)

- Pending is never counted as completed, and pending or rejected appointments never enter the due cohort.
- Rejected requests are excluded from every rate and every volume count.
- Notification data is never used.

## Buckets

- Month: the Manila `YYYY-MM` of `scheduled_at`. Monthly series list every month the period touches, with empty months as 0.
- Weekday: Manila weekday, Monday first.
- Hour bucket: two-hour Manila buckets `00–02`, `02–04`, … `22–24` (start hour inclusive).

## Datasets

| Dataset | Shape | Basis |
|---|---|---|
| KPIs | total, due count, completion/no-show/cancellation rates, pending | as above |
| Monthly volume | month → total | Total per month |
| By doctor | doctor → total, due count, cancellation and no-show rates | sorted by total desc, then name |
| Heatmap | weekday × hour bucket → total | full 7 × 12 grid |
| Status by month | month → count per status except `rejected` | all cancellations, by scheduled month |
| Rates by slot | weekday × hour bucket → due count, cancellation and no-show rates | only cells with due appointments |
