import { matchupTeamStrength, modelRatingAudit, preseasonTeamStrength } from "./modelRatings";
import { buildRatingState, isNeutralSite, kickoffTime, type RatingGame } from "./ratingEngine";
import { currentQuarterbackInput, type QuarterbackInput } from "./quarterbackInputs";

export function predictionContext(game: RatingGame, schedule: RatingGame[], now = new Date(), quarterbacks: QuarterbackInput[] = []) {
  const asOf = new Date(Math.min(now.getTime(), kickoffTime(game)));
  const ratings = buildRatingState(schedule, asOf);
  const strength = (side: "away" | "home") => {
    const team = game[`${side}_team`];
    const id = game[`${side}_team_id`];
    const input = currentQuarterbackInput(quarterbacks, team.abbreviation, game.week, asOf);
    const audit = modelRatingAudit(team.abbreviation);
    const qbDelta = input && audit ? input.adjustment - audit.quarterbackAdjustment : matchupTeamStrength(team.abbreviation, game.week) - preseasonTeamStrength(team.abbreviation);
    return { rating: (ratings.get(id) ?? preseasonTeamStrength(team.abbreviation)) + qbDelta, input: input ?? null };
  };
  const away = strength("away");
  const home = strength("home");
  return { awayRating: away.rating, homeRating: home.rating, neutralSite: isNeutralSite(game), asOf: asOf.toISOString(), awayQuarterback: away.input, homeQuarterback: home.input };
}
