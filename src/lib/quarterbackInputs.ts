import { MODEL_RATINGS, modelRatingAudit, normalizeTeamAbbreviation, replacementQuarterbackAdjustment } from "./modelRatings";

export type QuarterbackInput = {
  season: number;
  week: number;
  team_abbreviation: string;
  observed_at: string;
  starter: string;
  status: string;
  adjustment: number;
  source: string;
};
export const QB_FRESH_HOURS = 36;
export function currentQuarterbackInput(inputs: QuarterbackInput[], abbreviation: string, week: number, asOf: Date) {
  return inputs.filter((input) => normalizeTeamAbbreviation(input.team_abbreviation) === normalizeTeamAbbreviation(abbreviation) &&
    input.week === week && new Date(input.observed_at).getTime() <= asOf.getTime() &&
    asOf.getTime() - new Date(input.observed_at).getTime() <= QB_FRESH_HOURS * 3600000)
    .sort((a, b) => b.observed_at.localeCompare(a.observed_at))[0];
}
type Athlete = { displayName?: string; injuries?: { status?: string }[] };
export type DepthChart = { depthchart?: { positions?: Record<string, { position?: { abbreviation?: string }; athletes?: Athlete[] }> }[] };
const unavailable = (athlete: Athlete) => (athlete.injuries ?? []).some((injury) => /^(out|injured reserve|ir|suspended|reserve|physically unable to perform)$/i.test(injury.status ?? ""));
export function quarterbackInputFromDepthChart(document: DepthChart, team: string, season: number, week: number, now: Date): QuarterbackInput | null {
  const audit = modelRatingAudit(team);
  if (!audit) return null;
  const position = document.depthchart?.flatMap((formation) => Object.values(formation.positions ?? {})).find((entry) => entry.position?.abbreviation === "QB");
  if (!position?.athletes?.length) return null;
  const expectedStarter = position.athletes.find((athlete) => !unavailable(athlete));
  if (!expectedStarter?.displayName) return null;
  const name = expectedStarter.displayName;
  const knownStarter = MODEL_RATINGS.find((row) => row.quarterback === name);
  const knownBackup = MODEL_RATINGS.find((row) => row.backupQuarterback === name);
  const adjustment = knownStarter?.quarterbackAdjustment ?? (knownBackup ? replacementQuarterbackAdjustment(knownBackup) : Math.min(-15, audit.quarterbackAdjustment - 10));
  return {
    season, week, team_abbreviation: normalizeTeamAbbreviation(team), observed_at: now.toISOString(),
    starter: name, status: expectedStarter.injuries?.map((injury) => injury.status).filter(Boolean).join(", ") || "No injury designation reported",
    adjustment: Math.round(adjustment),
    source: `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${normalizeTeamAbbreviation(team).toLowerCase()}/depthcharts`,
  };
}
