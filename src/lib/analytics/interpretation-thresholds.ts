/**
 * ADM-17 interpretation thresholds and data minimums (docs/analytics-definitions.md
 * v3). Approved as listed on 2026-11-16; tune after real data, with sign-off.
 */

/** Monthly volume: months with appointments, and appointments in total. */
export const MIN_VOLUME_MONTHS = 2;
export const MIN_VOLUME_TOTAL = 20;
/** Last ÷ first month with appointments. */
export const GROWING_RATIO = 1.2;
export const FALLING_RATIO = 0.8;

/** Load by doctor: doctors compared must each have at least this many appointments. */
export const MIN_DOCTORS = 2;
export const MIN_DOCTOR_APPOINTMENTS = 5;
/** Busiest ÷ quietest compared doctor. */
export const UNEVEN_RATIO = 2;
export const SOMEWHAT_UNEVEN_RATIO = 1.3;

/** Peak heatmap: appointments across the shown cells; peak cell ÷ average cell. */
export const MIN_HEATMAP_TOTAL = 30;
export const RUSH_HOUR_RATIO = 2;

/** Outcomes, weekday rates, doctor rates: finished visits (the outcome cohort). */
export const MIN_FINISHED_VISITS = 20;
/** Missed (cancelled + no-show) ÷ finished visits. */
export const HIGH_MISSED_SHARE = 0.2;
export const MODERATE_MISSED_SHARE = 0.1;
/** A weekday's or doctor's missed rate ÷ the period's average missed rate. */
export const STANDS_OUT_RATIO = 1.5;
