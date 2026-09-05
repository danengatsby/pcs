export const mobilizationActionTypes = [
  "event",
  "campaign",
  "volunteer_task",
  "petition",
  "consultation",
] as const;

export type MobilizationActionType = typeof mobilizationActionTypes[number];

export const mobilizationInterestValues = [
  "pensii",
  "sanatate",
  "servicii_locale",
  "combaterea_izolarii",
  "comunicare",
  "organizare",
] as const;

export const mobilizationAvailabilityValues = [
  "dimineata",
  "dupa_amiaza",
  "seara",
  "weekend",
  "flexibil",
] as const;

export type MobilizationAction = {
  id: string;
  slug: string;
  type: MobilizationActionType;
  title: string;
  summary: string;
  description: string;
  scope: "national" | "local" | "online";
  county: string;
  locality: string;
  startsAt: string | null;
  endsAt: string | null;
  participationMode: string;
  commitment: string;
  capacity: number | null;
  availableSpots: number | null;
  responseCount: number | null;
};
