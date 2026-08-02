import { MODEL_VERSION, preseasonTeamStrength } from "./modelRatings";

export const MATCHUP_MODEL_VERSION = MODEL_VERSION;
export const HOME_FIELD_ELO = 55;
const WEEK_ONE_CONFIDENCE = 2 / 3;
const WEEK_ONE_MAX = 0.74;
const REST_FACTOR_START_WEEK = 3;
const REST_BOOST_PER_DAY = 0.0075;
const MAX_REST_BOOST = 0.03;
export const DIVISION_MATCHUP_MAX = 0.7;
export const STANDARD_MATCHUP_MAX = 0.95;

export function teamStrength(abbreviation: string) {
  return preseasonTeamStrength(abbreviation);
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
  const awayRating = teamStrength(awayAbbreviation);
  const homeRating = teamStrength(homeAbbreviation) + HOME_FIELD_ELO;
  const rawHome = 1 / (1 + 10 ** ((awayRating - homeRating) / 400));
  const baseHome = week === 1 ? applyWeekOneUncertainty(rawHome) : rawHome;
  const wholeRestDays = Math.round(Math.abs(homeRestAdvantageDays));
  const restAdjustment =
    week !== undefined && week >= REST_FACTOR_START_WEEK
      ? Math.sign(homeRestAdvantageDays) *
        Math.min(wholeRestDays * REST_BOOST_PER_DAY, MAX_REST_BOOST)
      : 0;
  const maximum = isDivisionMatchup ? DIVISION_MATCHUP_MAX : STANDARD_MATCHUP_MAX;
  const home = Math.min(maximum, Math.max(1 - maximum, baseHome + restAdjustment));

  return { away: 1 - home, home, restAdjustment };
}

export function formatFavorability(value: number) {
  return `${Math.round(value * 100)}%`;
}
