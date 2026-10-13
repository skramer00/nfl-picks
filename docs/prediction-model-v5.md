# Prediction model 2026.5

Released changes:

- Rankings and forecast probabilities share the same chronological, margin-weighted Elo updates (K=24). The existing 2025-derived preseason prior remains unchanged. Only final results observed by the prediction cutoff are eligible.
- Provider neutral-site flags override a named international-venue fallback. Neutral games receive no standard 55-point home advantage in either learning or prediction.
- ESPN depth charts refresh expected quarterbacks for games in the next seven days. Freshness is 36 hours and inputs apply to that week only. Refresh runs with existing result synchronization; failures retain explicit fallback status. Explicit Out/IR/suspended players are skipped. Questionable/doubtful players are displayed without an invented probability of playing. Depth charts are not guaranteed official inactive lists.
- Unknown backups are shrunk to a conservative replacement prior (at most -15 Elo and at least 10 below the team's pretrained starter). Existing backup evidence is weighted by sample size. This parameter is an initial assumption, not an estimated causal QB effect.
- Original `model_prediction_snapshots` remain immutable. `model_forecasts` stores separate early (within 30h) and final (within 1h) predictions, inputs, raw automatic probabilities, overrides, and model version. The existing 15-minute database scheduler drives captures during its configured active windows; missed windows fall back visibly to the early archive.
- An unchanged 2026.4 automatic preseason baseline is captured alongside 2026.5 at identical timestamps. Performance comparisons require paired final forecasts and exclude manual overrides by using the saved automatic probability. The main scorecard preserves manual picks with separate source breakdowns.
- Probability quality is tracked with Brier score and log loss, alongside same-game home-only accuracy, expected correct picks, ties, confidence bands, and model-version breakdowns.

## Validation

`model-v5-validation.json` records reproducible checks; no coefficients were tuned on these results.

2026 retrospective replay: 75 decisive games with automatic archived predictions, using their original capture timestamps. Original 42/75 (56.0%), revised 45/75 (60.0%); Brier 0.2366 to 0.2291. This is not live 2026.5 performance. Historical current-QB reports are unavailable; they are not reconstructed. Final-result `updated_at` timestamps conservatively gate the use of previous results; corrections can exclude otherwise available history.

Multi-season architecture check: 2010–2020 neutral-initialized Elo warm-up and 2021–2025 chronological evaluation, 1,355 decisive games. Frozen season-start baseline 59.0%, updated ratings/neutral venues 63.0%; Brier 0.2374 to 0.2259. Each model starts a season from the same regressed Elo prior, and results are held out for 24 hours before being used. This is an architecture check, not a historical reconstruction of the current model's preseason EPA/QBR/coaching inputs.

Removing the divisional cap slightly worsened pooled probability error. Removing rest or Week 1 regression changed Brier by less than 0.0001. Keep these parameters stable pending stronger held-out evidence. A full multi-season fit of overlapping EPA, scoring, outcome and QB coefficients requires historical as-of input archives; this release does not claim to have performed that fit.

Reproduce:

```sh
python scripts/fetch-backtest-data.py > /tmp/nfl-history.json
node --import tsx scripts/backtest-model.ts /tmp/nfl-history.json
# Optional second argument: a read-only export of 2026 games joined to snapshots.
```

Source: https://github.com/nflverse/nfldata/blob/master/data/games.csv

## Operational notes

The quarterback and forecast tables are intentionally publicly readable (sports/model data), with RLS and no client write permissions. Forecast updates/deletes are blocked by the immutable-history trigger. The original archive was checked before and after the schema addition: all 79 rows remain, scoring 44/78 plus one tie.

Historical and live estimates have limitations: current injury feeds may lag, QB effects are bounded assumptions, and preseason efficiency components remain fixed. Improvements must be judged by the forward paired scorecard, not just this retrospective replay.
