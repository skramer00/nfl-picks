export type MarketQuote = {
  provider: string; observed_at: string; provider_event_id: string; source: string;
  home_moneyline: number; away_moneyline: number; home_probability: number;
};
export function noVigHomeProbability(home: number, away: number) {
  const implied = (odds: number) => odds < 0 ? -odds / (100 - odds) : 100 / (100 + odds);
  if (![home, away].every((n) => Number.isFinite(n) && Math.abs(n) >= 100)) return null;
  const h = implied(home); const a = implied(away);
  return h / (h + a);
}
export type OddsDocument = { header?: { competitions?: { status?: { type?: { state?: string } } }[] }; pickcenter?: {
  provider?: { name?: string }; homeTeamOdds?: { moneyLine?: number }; awayTeamOdds?: { moneyLine?: number };
}[] };
export function marketQuote(document: OddsDocument, eventId: string, observedAt: Date): MarketQuote | null {
  if (document.header?.competitions?.[0]?.status?.type?.state !== "pre") return null;
  const quote = document.pickcenter?.find((row) => row.provider?.name === "DraftKings");
  const home = quote?.homeTeamOdds?.moneyLine; const away = quote?.awayTeamOdds?.moneyLine;
  if (home == null || away == null) return null;
  const probability = noVigHomeProbability(home, away);
  if (probability === null) return null;
  return { provider: "DraftKings", observed_at: observedAt.toISOString(), provider_event_id: eventId,
    source: `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${eventId}`,
    home_moneyline: home, away_moneyline: away, home_probability: probability };
}
