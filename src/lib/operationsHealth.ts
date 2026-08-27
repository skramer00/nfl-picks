export type OperationsGame = {
  id: string;
  week: number;
  kickoff_at: string;
  status: string;
  away_score: number | null;
  home_score: number | null;
  winner_team_id: string | null;
};

export type OperationsSnapshot = {
  game_id: string;
  capture_is_pregame: boolean;
};

export type OperationsSyncRun = {
  status: string;
  finished_at: string | null;
};

export function scheduleHealth(games: OperationsGame[]) {
  const weekCounts = new Map<number, number>();
  for (const game of games) weekCounts.set(game.week, (weekCounts.get(game.week) ?? 0) + 1);
  const expected = [16, 16, 16, 16, 15, 14, 14, 14, 15, 14, 13, 16, 14, 15, 16, 16, 16, 16];
  const complete = games.length === 272 && expected.every((count, index) => weekCounts.get(index + 1) === count);
  return { games: games.length, weeks: weekCounts.size, complete };
}

export function snapshotHealth(games: OperationsGame[], snapshots: OperationsSnapshot[], now = new Date()) {
  const snapshotByGame = new Map(snapshots.map((snapshot) => [snapshot.game_id, snapshot]));
  const deadline = now.getTime() + 30 * 60 * 60 * 1000;
  const due = games.filter((game) => {
    const kickoff = new Date(game.kickoff_at).getTime();
    return kickoff >= now.getTime() && kickoff <= deadline;
  });
  const missingDue = due.filter((game) => !snapshotByGame.has(game.id)).length;
  const late = snapshots.filter((snapshot) => !snapshot.capture_is_pregame).length;
  return { captured: snapshots.length, due: due.length, missingDue, late, ready: missingDue === 0 && late === 0 };
}

export function finalResultHealth(games: OperationsGame[]) {
  const finals = games.filter((game) => game.status === "final");
  const incomplete = finals.filter((game) =>
    game.away_score === null || game.home_score === null ||
    (game.away_score !== game.home_score && !game.winner_team_id)
  ).length;
  return { finals: finals.length, incomplete, ready: incomplete === 0 };
}

export function gameDayHealth(
  games: OperationsGame[],
  runs: OperationsSyncRun[],
  now = new Date()
) {
  const nowMs = now.getTime();
  const monitoredStart = nowMs - 6 * 60 * 60 * 1000;
  const monitoredEnd = nowMs + 60 * 60 * 1000;
  const staleResultDeadline = nowMs - 6 * 60 * 60 * 1000;
  const recentFailureDeadline = nowMs - 24 * 60 * 60 * 1000;

  const monitoredGameIds = games
    .filter((game) => {
      const kickoff = new Date(game.kickoff_at).getTime();
      return kickoff >= monitoredStart && kickoff <= monitoredEnd;
    })
    .map((game) => game.id);

  const attentionGameIds = games
    .filter((game) => {
      const kickoff = new Date(game.kickoff_at).getTime();
      const incompleteFinal = game.status === "final" && (
        game.away_score === null ||
        game.home_score === null ||
        (game.away_score !== game.home_score && !game.winner_team_id)
      );
      const overdue = kickoff < staleResultDeadline && game.status !== "final";
      return incompleteFinal || overdue;
    })
    .map((game) => game.id);

  const latestSuccessfulSyncAt = runs.find((run) => run.status === "success")?.finished_at ?? null;
  const latestSuccessfulSyncMs = latestSuccessfulSyncAt
    ? new Date(latestSuccessfulSyncAt).getTime()
    : null;
  const syncFresh = monitoredGameIds.length === 0 || (
    latestSuccessfulSyncMs !== null && nowMs - latestSuccessfulSyncMs <= 30 * 60 * 1000
  );
  const recentFailures = runs.filter((run) => (
    run.status === "error" &&
    run.finished_at !== null &&
    new Date(run.finished_at).getTime() >= recentFailureDeadline
  )).length;
  const nextKickoff = games
    .map((game) => game.kickoff_at)
    .filter((kickoff) => new Date(kickoff).getTime() > nowMs)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0] ?? null;

  return {
    monitoredGameIds,
    attentionGameIds,
    latestSuccessfulSyncAt,
    syncFresh,
    recentFailures,
    nextKickoff,
    ready: syncFresh && recentFailures === 0 && attentionGameIds.length === 0,
  };
}
