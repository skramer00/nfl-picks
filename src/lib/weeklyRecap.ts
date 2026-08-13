import type { GameRow } from "@/lib/gamesDb";
import { modelFavorite } from "@/lib/modelAnalytics";

function selectedTeam(game: GameRow, teamId: string) { return teamId === game.home_team_id ? game.home_team : game.away_team; }
function probability(game: GameRow, teamId: string) { return teamId === game.home_team_id ? game.home_win_prob ?? 0.5 : game.away_win_prob ?? 0.5; }

export function buildWeeklyRecap(games: GameRow[], picks: Record<string, string>, week: number) {
  const weekGames = games.filter((game) => game.week === week);
  const finals = weekGames.filter((game) => game.status === "final" && game.winner_team_id && picks[game.id]);
  const correct = finals.filter((game) => picks[game.id] === game.winner_team_id).length;
  const agreements = finals.filter((game) => picks[game.id] === modelFavorite(game).teamId).length;
  const upsets = finals.filter((game) => picks[game.id] === game.winner_team_id && picks[game.id] !== modelFavorite(game).teamId).sort((a, b) => modelFavorite(b).probability - modelFavorite(a).probability);
  const misses = finals.filter((game) => picks[game.id] !== game.winner_team_id).sort((a, b) => probability(b, picks[b.id]) - probability(a, picks[a.id]));
  const best = upsets[0]; const miss = misses[0];
  return {
    week,
    games: weekGames.length,
    finalPicks: finals.length,
    correct,
    points: finals.length + correct,
    accuracy: finals.length ? Math.round((correct / finals.length) * 100) : null,
    agreement: finals.length ? Math.round((agreements / finals.length) * 100) : null,
    pending: weekGames.filter((game) => game.status !== "final").length,
    bestUpset: best ? { team: selectedTeam(best, picks[best.id]).name, probability: Math.round(probability(best, picks[best.id]) * 100), opponent: selectedTeam(best, picks[best.id] === best.home_team_id ? best.away_team_id : best.home_team_id).name } : null,
    biggestMiss: miss ? { team: selectedTeam(miss, picks[miss.id]).name, probability: Math.round(probability(miss, picks[miss.id]) * 100), winner: selectedTeam(miss, miss.winner_team_id!).name } : null,
  };
}
