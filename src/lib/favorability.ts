// Preseason team strength snapshot used for the 2026 pick-assist percentages.
// Ratings are converted to matchup probabilities with the standard Elo formula.
const TEAM_ELO: Record<string, number> = {
  ARI: 1347, ATL: 1496, BAL: 1574, BUF: 1658, CAR: 1409, CHI: 1573,
  CIN: 1507, CLE: 1385, DAL: 1505, DEN: 1554, DET: 1622, GB: 1501,
  HOU: 1621, IND: 1409, JAX: 1629, KC: 1447, LAC: 1468, LAR: 1682,
  LV: 1292, MIA: 1351, MIN: 1480, NE: 1648, NO: 1412, NYG: 1421,
  NYJ: 1209, PHI: 1594, PIT: 1512, SEA: 1751, SF: 1626, TB: 1455,
  TEN: 1339, WAS: 1334,
};

const HOME_FIELD_ELO = 55;
const WEEK_ONE_CONFIDENCE = 2 / 3;
const WEEK_ONE_MAX = 0.74;
const REST_FACTOR_START_WEEK = 3;
const REST_BOOST_PER_DAY = 0.0075;
const MAX_REST_BOOST = 0.03;
const DIVISION_MATCHUP_MAX = 0.7;

export function teamStrength(abbreviation: string) {
  return TEAM_ELO[abbreviation] ?? 1505;
}

function applyWeekOneUncertainty(homeProbability: number) {
  const regressed = 0.5 + (homeProbability - 0.5) * WEEK_ONE_CONFIDENCE;
  return Math.min(WEEK_ONE_MAX, Math.max(1 - WEEK_ONE_MAX, regressed));
}

export function matchupFavorability(
  awayAbbreviation: string,
  homeAbbreviation: string,
  week?: number,
  homeRestAdvantageDays = 0,
  isDivisionMatchup = false
) {
  const awayRating = TEAM_ELO[awayAbbreviation] ?? 1505;
  const homeRating = (TEAM_ELO[homeAbbreviation] ?? 1505) + HOME_FIELD_ELO;
  const rawHome = 1 / (1 + 10 ** ((awayRating - homeRating) / 400));
  const baseHome = week === 1 ? applyWeekOneUncertainty(rawHome) : rawHome;
  const wholeRestDays = Math.round(Math.abs(homeRestAdvantageDays));
  const restAdjustment =
    week !== undefined && week >= REST_FACTOR_START_WEEK
      ? Math.sign(homeRestAdvantageDays) *
        Math.min(wholeRestDays * REST_BOOST_PER_DAY, MAX_REST_BOOST)
      : 0;
  const maximum = isDivisionMatchup ? DIVISION_MATCHUP_MAX : 0.95;
  const home = Math.min(maximum, Math.max(1 - maximum, baseHome + restAdjustment));

  return { away: 1 - home, home, restAdjustment };
}

export function formatFavorability(value: number) {
  return `${Math.round(value * 100)}%`;
}
