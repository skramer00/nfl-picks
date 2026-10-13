import { fetchEspnWeek } from "./results/espn";
import type { SnapshotGame } from "./predictionSnapshots";
import { efficiencyTeam } from "./efficiencyModel";
import { marketQuote, type MarketQuote, type OddsDocument } from "./marketOdds";

export async function fetchPregameMarkets(games: SnapshotGame[], season: number) {
  const quotes = new Map<string, MarketQuote>();
  const errors: string[] = [];
  const weeks = [...new Set(games.map((game) => game.week))];
  for (const week of weeks) {
    try {
      const events = await fetchEspnWeek(season, week);
      const pending = games.filter((g) => g.week === week);
      // Bound outbound requests to four at a time.
      for (let i = 0; i < pending.length; i += 4) await Promise.all(pending.slice(i, i + 4).map(async (game) => {
        const event = events.find((e) => efficiencyTeam(e.away) === efficiencyTeam(game.away_team.abbreviation) && efficiencyTeam(e.home) === efficiencyTeam(game.home_team.abbreviation));
        if (!event || event.status !== "scheduled" || Math.abs(Date.parse(event.kickoffAt) - Date.parse(game.kickoff_at)) > 60000) { errors.push(`${game.id}:unmatched-or-started`); return; }
        try {
          const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${event.providerId}`, { cache: "no-store", signal: AbortSignal.timeout(10000) });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const document = await response.json() as OddsDocument;
          const observed = new Date();
          const quote = marketQuote(document, event.providerId, observed);
          if (quote && observed.getTime() < Date.parse(game.kickoff_at)) quotes.set(game.id, quote);
          else errors.push(`${game.id}:no-pregame-moneyline`);
        } catch { errors.push(`${game.id}:provider-unavailable`); }
      }));
    } catch { errors.push(`week-${week}:provider-unavailable`); }
  }
  return { quotes, errors };
}
