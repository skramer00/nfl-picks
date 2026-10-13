/** Usage: node --import tsx scripts/backtest-model.ts historical-games.json [archive.json]
 * Historical rows: season, week, kickoff, home, away, homeScore, awayScore,
 * neutral, homeRest, awayRest. See scripts/fetch-backtest-data.py.
 * This evaluates the rating-update architecture, NOT a historical reconstruction
 * of 2026 QB/roster inputs. No 2026 ratings enter the multi-season benchmark.
 */
import { readFileSync } from "node:fs";
import { expectedHomeScore, resultRatingChange } from "../src/lib/ratingEngine";
import { probabilityMetrics, type ScoredProbability } from "../src/lib/probabilityMetrics";
import { predictionSnapshotForGame, type SnapshotGame } from "../src/lib/predictionSnapshots";
import { buildRestAdvantageMap } from "../src/lib/restAdvantage";

type HistoricalGame = { season: number; week: number; kickoff: string; home: string; away: string; homeScore: number; awayScore: number; neutral: boolean; homeRest: number; awayRest: number };
const games = JSON.parse(readFileSync(process.argv[2], "utf8")) as HistoricalGame[];
const divisions = ["BUF MIA NE NYJ", "BAL CIN CLE PIT", "HOU IND JAX TEN", "DEN KC LV LAC", "DAL NYG PHI WSH", "CHI DET GB MIN", "ATL CAR NO TB", "ARI LAR SF SEA"].map((division) => new Set(division.split(" ")));
const rating = new Map<string, number>();
let preseason = new Map<string, number>();
let season = 0;
const pending: HistoricalGame[] = [];
const experiments = ["frozen", "updated", "updated_no_division_cap", "updated_no_rest", "updated_no_week1_regression"];
const scores = new Map<string, ScoredProbability[]>();
function settle(game: HistoricalGame) {
  const away = rating.get(game.away) ?? 1500;
  const home = rating.get(game.home) ?? 1500;
  const change = resultRatingChange(away, home, game.awayScore, game.homeScore, game.neutral);
  rating.set(game.away, away - change);
  rating.set(game.home, home + change);
}
for (const game of games.sort((a, b) => a.kickoff.localeCompare(b.kickoff))) {
  // Historical feed has no result-publication timestamp: wait a full 24 hours.
  while (pending.length && new Date(pending[0].kickoff).getTime() + 86400000 < new Date(game.kickoff).getTime()) settle(pending.shift()!);
  if (game.season !== season) {
    season = game.season;
    for (const [team, value] of rating) rating.set(team, 1500 + (value - 1500) * .7);
    preseason = new Map(rating);
  }
  if (game.season >= 2021 && game.homeScore !== game.awayScore) {
    for (const experiment of experiments) {
      const r = experiment === "frozen" ? preseason : rating;
      let p = expectedHomeScore(r.get(game.away) ?? 1500, r.get(game.home) ?? 1500, experiment === "frozen" ? false : game.neutral);
      if (game.week === 1 && experiment !== "updated_no_week1_regression") p = Math.max(.26, Math.min(.74, .5 + (p - .5) * 2 / 3));
      if (game.week >= 3 && experiment !== "updated_no_rest") p += Math.sign(game.homeRest - game.awayRest) * Math.min(.03, Math.round(Math.abs(game.homeRest - game.awayRest)) * .0075);
      const divisional = divisions.some((division) => division.has(game.home) && division.has(game.away));
      const max = divisional && experiment !== "updated_no_division_cap" ? .7 : .95;
      p = Math.max(1 - max, Math.min(max, p));
      for (const group of [String(season), "pooled"]) {
        const key = `${group}:${experiment}`;
        const rows = scores.get(key) ?? [];
        rows.push({ probability: p, outcome: Number(game.homeScore > game.awayScore) });
        scores.set(key, rows);
      }
    }
  }
  pending.push(game);
}
const historical = Object.fromEntries([...scores].map(([key, rows]) => [key, probabilityMetrics(rows)]));
let replay = null;
if (process.argv[3]) {
  const archive = JSON.parse(readFileSync(process.argv[3], "utf8")) as (SnapshotGame & { snapshot: { captured_at: string; home_win_probability: number; manual_override: boolean } })[];
  const rest = buildRestAdvantageMap(archive);
  const original: ScoredProbability[] = [];
  const revised: ScoredProbability[] = [];
  for (const game of archive) {
    if (!game.snapshot || game.snapshot.manual_override || game.home_score == null || game.away_score == null || game.home_score === game.away_score) continue;
    const snapshot = predictionSnapshotForGame({ game, schedule: archive, now: new Date(game.snapshot.captured_at), rest: rest.get(game.id), source: "manual" });
    const outcome = Number(game.home_score > game.away_score);
    original.push({ probability: Number(game.snapshot.home_win_probability), outcome });
    revised.push({ probability: snapshot.home_win_probability, outcome });
  }
  replay = { original: probabilityMetrics(original), revised: probabilityMetrics(revised), note: "Retrospective replay at original capture timestamps; excludes manual overrides and ties. Historical live QB reports are unavailable and are not reconstructed. Current final-result updated_at timestamps are used conservatively." };
}
console.log(JSON.stringify({ generatedAt: new Date().toISOString(), source: "https://github.com/nflverse/nfldata/blob/master/data/games.csv", historicalMethod: "2010–2020 warm-up; 2021–2025 chronological evaluation, same preseason Elo prior for each experiment. Results available after 24h; 70% offseason retention. Architecture/heuristic check only, not a full backtest of the 2026 roster model. No coefficients optimized on these results.", historical, replay }, null, 2));
