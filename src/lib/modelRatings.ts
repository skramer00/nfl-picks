import modelData from "@/data/model_ratings_2026.json";

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

export function preseasonTeamStrength(abbreviation: string) {
  return modelRatingAudit(abbreviation)?.rating ?? modelData.methodology.neutralRating;
}
