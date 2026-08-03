import modelData from "@/data/model_ratings_2026.json";
import availabilityData from "@/data/quarterback_availability_2026.json";
import offseasonData from "@/data/offseason_adjustments_2026.json";

type BaseModelRating = (typeof modelData.teams)[number];
type OffseasonTeam = (typeof offseasonData.teams)[keyof typeof offseasonData.teams];
export type ModelRatingAudit = BaseModelRating & {
  baseRating: number;
  offseasonAdjustment: number;
};

function boundedTotal(entries: { finalPoints: number }[], cap: number) {
  const total = entries.reduce((sum, entry) => sum + entry.finalPoints, 0);
  return Math.min(cap, Math.max(-cap, total));
}

export function offseasonAdjustmentAudit(abbreviation: string) {
  const normalized = normalizeTeamAbbreviation(abbreviation);
  const team = offseasonData.teams[normalized as keyof typeof offseasonData.teams] as OffseasonTeam | undefined;
  const coaching = team?.coaching ?? [];
  const personnel = team?.personnel ?? [];
  const coachingPoints = boundedTotal(coaching, offseasonData.methodology.coachingCap);
  const personnelPoints = boundedTotal(personnel, offseasonData.methodology.personnelCap);
  return {
    coaching,
    personnel,
    coachingPoints,
    personnelPoints,
    total: coachingPoints + personnelPoints,
  };
}

export const MODEL_RATINGS: ModelRatingAudit[] = modelData.teams
  .map((team) => {
    const offseasonAdjustment = offseasonAdjustmentAudit(team.abbreviation).total;
    return {
      ...team,
      baseRating: team.rating,
      offseasonAdjustment,
      rating: team.rating + offseasonAdjustment,
    };
  })
  .sort((first, second) => second.rating - first.rating);

const ratings = new Map(
  MODEL_RATINGS.map((team) => [team.abbreviation, team] as const),
);

export const MODEL_VERSION = modelData.version;
export const MODEL_GENERATED_AT = modelData.generatedAt;
export const MODEL_METHODOLOGY = modelData.methodology;
export const MODEL_OFFSEASON_METHODOLOGY = offseasonData.methodology;
export const MODEL_SOURCES = modelData.sources;

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
