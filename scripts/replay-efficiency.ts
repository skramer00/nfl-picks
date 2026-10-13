/** node --import tsx scripts/replay-efficiency.ts archive.json observations.json [--assume-24h]
 * Strict mode respects real observation times. The optional retrospective mode
 * is explicitly hypothetical; neither mode writes any production forecasts.
 */
import { readFileSync } from "node:fs";
import { efficiencyShadowContext, type EfficiencyObservation } from "../src/lib/efficiencyModel";
import { predictionContext } from "../src/lib/predictionContext";
import { matchupFavorability } from "../src/lib/favorability";
import { buildRestAdvantageMap } from "../src/lib/restAdvantage";
import { probabilityMetrics } from "../src/lib/probabilityMetrics";
import type { SnapshotGame } from "../src/lib/predictionSnapshots";

const games = JSON.parse(readFileSync(process.argv[2], "utf8")) as (SnapshotGame & { snapshot: { captured_at: string; manual_override: boolean } })[];
const observations = JSON.parse(readFileSync(process.argv[3], "utf8")) as EfficiencyObservation[];
const hypothetical = process.argv.includes("--assume-24h");
const rows = hypothetical ? observations.map((row) => ({ ...row, observed_at: new Date(Date.parse(row.kickoff_at) + 86400000).toISOString() })) : observations;
const rest = buildRestAdvantageMap(games);
const live: { probability: number; outcome: number }[] = [];
const trial: typeof live = [];
for (const game of games) {
  if (!game.snapshot || game.snapshot.manual_override || game.home_score == null || game.away_score == null || game.home_score === game.away_score) continue;
  const now = new Date(game.snapshot.captured_at);
  const context = predictionContext(game, games, now);
  const shadow = efficiencyShadowContext(game, context, rows, now);
  if (!shadow) continue;
  const divisional = game.away_team.conference === game.home_team.conference && game.away_team.division === game.home_team.division;
  const probability = (c: typeof context) => matchupFavorability(game.away_team.abbreviation, game.home_team.abbreviation, game.week, rest.get(game.id)?.homeAdvantageDays ?? 0, divisional, c).home;
  const outcome = Number(game.home_score > game.away_score);
  live.push({ probability: probability(context), outcome });
  trial.push({ probability: probability(shadow), outcome });
}
console.log(JSON.stringify({ mode: hypothetical ? "Hypothetical 24h publication lag; revised historical source, no archived historical QB reports. NOT a leakage-free backtest or forward result." : "Strict recorded observation timestamps", live: probabilityMetrics(live), trial: probabilityMetrics(trial) }, null, 2));
