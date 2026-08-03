import modelData from "@/data/model_ratings_2026.json";
import availabilityData from "@/data/quarterback_availability_2026.json";

export type ModelRatingAudit = (typeof modelData.teams)[number];

const ratings = new Map(
  modelData.teams.map((team) => [team.abbreviation, team] as const),
);

export const MODEL_VERSION = modelData.version;
export const MODEL_GENERATED_AT = modelData.generatedAt;
export const MODEL_METHODOLOGY = modelData.methodology;
export const MODEL_SOURCES = modelData.sources;
export const MODEL_RATINGS = modelData.teams;

export function normalizeTeamAbbreviation(abbreviation: string) {
  return abbreviation === "WAS" ? "WSH" : abbreviation;
}

export function modelRatingAudit(abbreviation: string) {
  return ratings.get(normalizeTeamAbbreviation(abbreviation)) ?? null;
}

export function quarterbackAvailabilityAudit(abbreviation: string) {
  const normalized = normalizeTeamAbbreviation(abbreviation);
  return availabilityData.teams[normalized as keyof typeof availabilityData.teams] ?? null;
}

export function quarterbackAvailability(abbreviation: string, week?: number) {
  if (week === undefined) return 1;
  const audit = quarterbackAvailabilityAudit(abbreviation);
  if (!audit) return 1;
  return audit.availabilityByWeek[
    String(week) as keyof typeof audit.availabilityByWeek
  ] ?? 1;
}

export function preseasonTeamStrength(abbreviation: string) {
  return modelRatingAudit(abbreviation)?.rating ?? modelData.methodology.neutralRating;
}

export function matchupTeamStrength(abbreviation: string, week?: number) {
  const audit = modelRatingAudit(abbreviation);
  if (!audit) return modelData.methodology.neutralRating;
  const availability = quarterbackAvailability(abbreviation, week);
  const effectiveQuarterback =
    audit.quarterbackAdjustment * availability +
    audit.backupQuarterbackAdjustment * (1 - availability);
  return audit.rating - audit.quarterbackAdjustment + effectiveQuarterback;
}
