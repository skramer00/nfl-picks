export type ScoredProbability = { probability: number; outcome: number };
export function probabilityMetrics(rows: ScoredProbability[]) {
  const valid = rows.filter((row) => Number.isFinite(row.probability) && row.probability >= 0 && row.probability <= 1 && (row.outcome === 0 || row.outcome === 1));
  const count = valid.length;
  const correct = valid.filter(({ probability, outcome }) => Number(probability >= 0.5) === outcome).length;
  return {
    count, correct, accuracy: count ? correct / count : null,
    brier: count ? valid.reduce((sum, row) => sum + (row.probability - row.outcome) ** 2, 0) / count : null,
    logLoss: count ? valid.reduce((sum, row) => {
      const p = Math.min(1 - 1e-15, Math.max(1e-15, row.probability));
      return sum - row.outcome * Math.log(p) - (1 - row.outcome) * Math.log(1 - p);
    }, 0) / count : null,
    expectedCorrect: valid.reduce((sum, row) => sum + Math.max(row.probability, 1 - row.probability), 0),
  };
}
