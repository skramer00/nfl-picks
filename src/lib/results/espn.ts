const ESPN_SCOREBOARD_URL =
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";

const TEAM_ALIASES: Record<string, string> = {
  OAK: "LV",
  WSH: "WAS",
};

type EspnCompetitor = {
  homeAway?: "home" | "away";
  score?: string;
  winner?: boolean;
  team?: { abbreviation?: string };
};

type EspnEvent = {
  id?: string;
  date?: string;
  status?: {
    type?: {
      state?: "pre" | "in" | "post";
      completed?: boolean;
      name?: string;
    };
  };
  competitions?: Array<{ competitors?: EspnCompetitor[] }>;
};

type EspnScoreboard = { events?: EspnEvent[] };

export type ProviderGame = {
  providerId: string;
  week: number;
  kickoffAt: string;
  away: string;
  home: string;
  status: "scheduled" | "in_progress" | "final";
  awayScore: number | null;
  homeScore: number | null;
};

function abbreviation(value: string | undefined) {
  if (!value) return "";
  return TEAM_ALIASES[value] ?? value;
}

function score(value: string | undefined, include: boolean) {
  if (!include || value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function fetchEspnWeek(season: number, week: number): Promise<ProviderGame[]> {
  const url = new URL(ESPN_SCOREBOARD_URL);
  url.searchParams.set("dates", String(season));
  url.searchParams.set("seasontype", "2");
  url.searchParams.set("week", String(week));

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`ESPN scoreboard returned HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as EspnScoreboard;
  return (payload.events ?? []).flatMap((event) => {
    const competitors = event.competitions?.[0]?.competitors ?? [];
    const away = competitors.find((team) => team.homeAway === "away");
    const home = competitors.find((team) => team.homeAway === "home");
    const state = event.status?.type?.state;

    if (!event.id || !event.date || !away || !home) return [];

    const isFinal = event.status?.type?.completed === true || state === "post";
    const isPlaying = state === "in";
    const includeScores = isFinal || isPlaying;

    return [{
      providerId: event.id,
      week,
      kickoffAt: event.date,
      away: abbreviation(away.team?.abbreviation),
      home: abbreviation(home.team?.abbreviation),
      status: isFinal ? "final" : isPlaying ? "in_progress" : "scheduled",
      awayScore: score(away.score, includeScores),
      homeScore: score(home.score, includeScores),
    } satisfies ProviderGame];
  });
}
