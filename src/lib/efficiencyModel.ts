import { MODEL_RATINGS, modelRatingAudit, normalizeTeamAbbreviation, preseasonTeamStrength, matchupTeamStrength } from "./modelRatings";
import type { predictionContext } from "./predictionContext";
import { kickoffTime, type RatingGame } from "./ratingEngine";

export const EFFICIENCY_MODEL_VERSION = "2026.6-efficiency-shadow";
export type EfficiencyObservation = {
  game_id: string; season: number; week: number; team: string; opponent: string;
  kickoff_at: string; observed_at: string; content_hash: string; source: string;
  plays: number; epa: number; successes: number;
  pass_plays: number; pass_epa: number; rush_plays: number; rush_epa: number;
};
export const efficiencyTeam = (team: string) => normalizeTeamAbbreviation(team === "LA" ? "LAR" : team);

// Select the latest revision actually available at forecast time, never the
// latest revision of the dataset retrospectively. A current-game row is ineligible.
export function availableEfficiency(rows: EfficiencyObservation[], asOf: Date, season: number) {
  const latest = new Map<string, EfficiencyObservation>();
  for (const row of rows) {
    if (row.season !== season || !Number.isFinite(row.plays) || row.plays <= 0 ||
      !Number.isFinite(row.epa) || !Number.isFinite(row.successes) || row.successes < 0 || row.successes > row.plays ||
      !(Date.parse(row.observed_at) <= asOf.getTime()) || !(Date.parse(row.kickoff_at) < asOf.getTime())) continue;
    const key = `${row.game_id}:${row.team}`;
    if (!latest.has(key) || latest.get(key)!.observed_at < row.observed_at) latest.set(key, row);
  }
  return [...latest.values()].sort((a, b) => a.game_id.localeCompare(b.game_id) || a.team.localeCompare(b.team));
}

// Ridge-style opponent adjustment: rate = league mean + offense + defense.
// 300 prior plays per unit temper small samples. Constants are experimental,
// fixed in advance, and must be evaluated on paired forward forecasts.
export function fitEfficiency(rows: EfficiencyObservation[]) {
  const teams = MODEL_RATINGS.map((row) => row.abbreviation);
  const priorEpaMean = MODEL_RATINGS.reduce((s, row) => s + row.offensiveEpaPerPlay, 0) / teams.length;
  const priorSuccessMean = MODEL_RATINGS.reduce((s, row) => s + row.offensiveSuccessRate, 0) / teams.length;
  const total = rows.reduce((s, row) => s + row.plays, 0);
  const fit = (metric: "epa" | "successes") => {
    const mean = total ? rows.reduce((s, row) => s + row[metric], 0) / total : 0;
    const priors = new Map(teams.map((team) => {
      const prior = modelRatingAudit(team)!;
      return [team, metric === "epa" ?
        { offense: prior.offensiveEpaPerPlay - priorEpaMean, defense: prior.defensiveEpaAllowedPerPlay - priorEpaMean } :
        { offense: prior.offensiveSuccessRate - priorSuccessMean, defense: prior.defensiveSuccessRateAllowed - priorSuccessMean }];
    }));
    const values = new Map([...priors].map(([team, value]) => [team, { ...value }]));
    for (let iteration = 0; iteration < 20; iteration++) {
      for (const team of teams) {
        const offense = rows.filter((row) => efficiencyTeam(row.team) === team);
        const defense = rows.filter((row) => efficiencyTeam(row.opponent) === team);
        const prior = priors.get(team)!;
        values.get(team)!.offense = (300 * prior.offense + offense.reduce((sum, row) => sum + row[metric] - row.plays * (mean + (values.get(efficiencyTeam(row.opponent))?.defense ?? 0)), 0)) / (300 + offense.reduce((sum, row) => sum + row.plays, 0));
        values.get(team)!.defense = (300 * prior.defense + defense.reduce((sum, row) => sum + row[metric] - row.plays * (mean + (values.get(efficiencyTeam(row.team))?.offense ?? 0)), 0)) / (300 + defense.reduce((sum, row) => sum + row.plays, 0));
      }
    }
    return { values, priors };
  };
  const epa = fit("epa");
  const success = fit("successes");
  return new Map(teams.map((team) => {
    const value = epa.values.get(team)!; const prior = epa.priors.get(team)!;
    const sr = success.values.get(team)!; const srPrior = success.priors.get(team)!;
    const delta = 25 * (0.7 * ((value.offense - value.defense) - (prior.offense - prior.defense)) / .1 +
      .3 * ((sr.offense - sr.defense) - (srPrior.offense - srPrior.defense)) / .05);
    const offense = rows.filter((row) => efficiencyTeam(row.team) === team);
    const defense = rows.filter((row) => efficiencyTeam(row.opponent) === team);
    return [team, { delta: Math.max(-100, Math.min(100, delta)), games: offense.length,
      plays: offense.reduce((s, row) => s + row.plays, 0), defensivePlays: defense.reduce((s, row) => s + row.plays, 0),
      adjustedOffenseEpa: value.offense, adjustedDefenseEpa: value.defense,
      adjustedOffenseSuccess: sr.offense, adjustedDefenseSuccess: sr.defense }];
  }));
}

export function efficiencyShadowContext(game: RatingGame & { season: number }, live: ReturnType<typeof predictionContext>, rows: EfficiencyObservation[], now: Date) {
  const eligible = availableEfficiency(rows, new Date(Math.min(now.getTime(), kickoffTime(game))), game.season);
  const fit = fitEfficiency(eligible);
  const away = fit.get(efficiencyTeam(game.away_team.abbreviation));
  const home = fit.get(efficiencyTeam(game.home_team.abbreviation));
  if (!away || !home || away.games < 2 || home.games < 2) return null;
  const strength = (side: "away" | "home", delta: number) => {
    const team = game[`${side}_team`].abbreviation;
    const prior = modelRatingAudit(team)!;
    const qb = side === "away" ? live.awayQuarterback : live.homeQuarterback;
    // Preserve exactly the live QB adjustment; replace 35% of the result-based
    // strength with the independently shrunk efficiency estimate, not an additive bonus.
    const qbDelta = qb ? qb.adjustment - prior.quarterbackAdjustment : matchupTeamStrength(team, game.week) - preseasonTeamStrength(team);
    return .65 * live[`${side}Rating`] + .35 * (preseasonTeamStrength(team) + delta + qbDelta);
  };
  return { ...live, awayRating: strength("away", away.delta), homeRating: strength("home", home.delta),
    efficiency: { away, home, blend: .35, priorPlays: 300,
      observations: eligible.map((row) => ({ game_id: row.game_id, team: row.team, observed_at: row.observed_at, content_hash: row.content_hash })) } };
}
