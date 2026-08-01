import games2026 from "@/data/games_2026.json";

export type Conference = "AFC" | "NFC";

export type Division =
  | "AFC East"
  | "AFC North"
  | "AFC South"
  | "AFC West"
  | "NFC East"
  | "NFC North"
  | "NFC South"
  | "NFC West";

export type TeamInfo = {
  abbreviation: string;
  name: string;
  conference: Conference;
  division: Division;
};

export type Game = {
  id: string;
  week: number;
  kickoffISO: string;
  awayTeam: string;
  homeTeam: string;
  status: "scheduled" | "final";
  winner: string | null;
  isTie: boolean;
  awayScore: number | null;
  homeScore: number | null;
};

const team = (
  abbreviation: string,
  name: string,
  conference: Conference,
  division: Division,
): TeamInfo => ({ abbreviation, name, conference, division });

export const TEAMS: TeamInfo[] = [
  team("BUF", "Buffalo Bills", "AFC", "AFC East"),
  team("MIA", "Miami Dolphins", "AFC", "AFC East"),
  team("NE", "New England Patriots", "AFC", "AFC East"),
  team("NYJ", "New York Jets", "AFC", "AFC East"),
  team("BAL", "Baltimore Ravens", "AFC", "AFC North"),
  team("CIN", "Cincinnati Bengals", "AFC", "AFC North"),
  team("CLE", "Cleveland Browns", "AFC", "AFC North"),
  team("PIT", "Pittsburgh Steelers", "AFC", "AFC North"),
  team("HOU", "Houston Texans", "AFC", "AFC South"),
  team("IND", "Indianapolis Colts", "AFC", "AFC South"),
  team("JAX", "Jacksonville Jaguars", "AFC", "AFC South"),
  team("TEN", "Tennessee Titans", "AFC", "AFC South"),
  team("DEN", "Denver Broncos", "AFC", "AFC West"),
  team("KC", "Kansas City Chiefs", "AFC", "AFC West"),
  team("LAC", "Los Angeles Chargers", "AFC", "AFC West"),
  team("LV", "Las Vegas Raiders", "AFC", "AFC West"),
  team("DAL", "Dallas Cowboys", "NFC", "NFC East"),
  team("NYG", "New York Giants", "NFC", "NFC East"),
  team("PHI", "Philadelphia Eagles", "NFC", "NFC East"),
  team("WSH", "Washington Commanders", "NFC", "NFC East"),
  team("CHI", "Chicago Bears", "NFC", "NFC North"),
  team("DET", "Detroit Lions", "NFC", "NFC North"),
  team("GB", "Green Bay Packers", "NFC", "NFC North"),
  team("MIN", "Minnesota Vikings", "NFC", "NFC North"),
  team("ATL", "Atlanta Falcons", "NFC", "NFC South"),
  team("CAR", "Carolina Panthers", "NFC", "NFC South"),
  team("NO", "New Orleans Saints", "NFC", "NFC South"),
  team("TB", "Tampa Bay Buccaneers", "NFC", "NFC South"),
  team("ARI", "Arizona Cardinals", "NFC", "NFC West"),
  team("LAR", "Los Angeles Rams", "NFC", "NFC West"),
  team("SF", "San Francisco 49ers", "NFC", "NFC West"),
  team("SEA", "Seattle Seahawks", "NFC", "NFC West"),
];

export const TEAM_BY_ABBR = Object.fromEntries(
  TEAMS.map((entry) => [entry.abbreviation, entry]),
) as Record<string, TeamInfo>;

export const DIVISIONS: Division[] = [
  "AFC East",
  "AFC North",
  "AFC South",
  "AFC West",
  "NFC East",
  "NFC North",
  "NFC South",
  "NFC West",
];

export const ALL_GAMES = games2026 as Game[];

export function gamesForWeek(week: number) {
  return ALL_GAMES.filter((game) => game.week === week);
}

