// Public volunteer statistics are national snapshots, never individual rows or
// overlapping cohorts. Suppress small groups and avoid exact headcounts.
export const volunteerStatisticsPrivacy = {
  scope: "national",
  minimumGroupSize: 10,
  roundingStep: 10,
  rounding: "down",
} as const;

export function publicVolunteerCount(count: number | undefined): number | null {
  if (count === undefined || !Number.isSafeInteger(count) || count < volunteerStatisticsPrivacy.minimumGroupSize) {
    return null;
  }
  return Math.floor(count / volunteerStatisticsPrivacy.roundingStep) * volunteerStatisticsPrivacy.roundingStep;
}
