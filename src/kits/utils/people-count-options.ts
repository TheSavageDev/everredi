const STANDARD_PEOPLE_COUNTS = [1, 2, 4, 6, 8, 12] as const;

/**
 * Returns additional people count options (below group_size) for kit templates.
 * Used so users can scale a template down (e.g. 12-person kit for 1, 2, 4, 6, or 8).
 */
export function getDefaultPeopleCountOptions(groupSize: number): number[] {
  return STANDARD_PEOPLE_COUNTS.filter((x) => x < groupSize);
}
