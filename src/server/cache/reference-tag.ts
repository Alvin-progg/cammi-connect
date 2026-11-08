/**
 * Cache tag for admin reference data: departments, specialties, doctors,
 * services, requirements, schedules, and knowledge documents. Those reads are
 * cached across requests, and every action that writes them calls
 * `updateTag(REFERENCE_CACHE_TAG)` so the next read is fresh. One tag on
 * purpose: lists show each other's names (doctors show departments,
 * requirements show services), and admin writes are rare.
 */
export const REFERENCE_CACHE_TAG = "reference";
