# Efficiency trial and market audit

Released October 13, 2026. Published probabilities remain model **2026.5**.
The new **2026.6-efficiency-shadow** version is experimental and is excluded
from picks, leaderboards, displayed game probabilities and playoff projections.

## Collection

- nflverse/nflfastR current-season `play_by_play_2026.csv.gz`, CC BY 4.0.
- Refresh via the existing authenticated results-sync job, at most every six
  hours on success; failed refreshes retry after an hour. Sources are fetched
  server-side with bounded request duration and parsing limits.
- Regular-season pass/run plays, including sacks; exclude no-plays, kneels,
  spikes and special teams. Success means nflfastR's positive-EPA success field.
- Only app-confirmed final games at least 24 hours after kickoff and with both
  offenses represented by at least 20 valid plays are ingested.
- Store EPA totals, successes and counts per game/team, plus pass/rush splits.
  A SHA-256 digest deduplicates identical observations. Changed statistics append
  a new version; old observations are immutable. Observation time is the actual
  retrieval time, never the historical game date.
- Imported app fixture IDs are matched by season/week/team pair, not assumed to
  be provider event IDs. LA/LAR and WAS/WSH aliases are normalized.
- Pregame odds: ESPN summary, DraftKings two-sided moneylines. Confirm provider
  game identity, kickoff and `pre` state. No closing or in-play values are used
  as purported earlier observations. Strip the bookmaker margin by normalizing
  the two implied probabilities.
- Market quotes are fetched before forecast generation, with at most five minutes
  between quote observation and forecast capture. Save the quote inside the
  immutable forecast and in an independent market history. Failed/missing quotes
  do not prevent production forecasts; they are excluded from market scoring.

## Candidate formula (fixed, unoptimized constants)

Fit offense and defense separately for EPA and success rate with
`observed rate = current league mean + offense + defense allowed`.
Twenty coordinate-update passes solve a ridge-style opponent adjustment with
300 preseason prior plays per unit. Preseason unit inputs come from the existing
2025 efficiency data. Compare each team's fitted offense-minus-defense with its
preseason equivalent:

`efficiencyDelta = clamp(25 × (0.7 × EPA net change / 0.1 + 0.3 × success net change / 0.05), -100, 100)`.

The candidate strength is a convex blend:

`0.65 × live strength + 0.35 × (preseason strength + efficiencyDelta + live QB delta)`.

Both branches preserve the same current QB adjustment. Home field, rest, Week 1
regression and divisional probability caps are unchanged. At least two eligible
games for each matchup team are required. This replaces part of the
result-driven adjustment, rather than adding a full efficiency bonus on top.
All observations must have been available before the forecast; later source
corrections cannot alter archived predictions.

This experiment does not yet estimate QB-specific efficiency or non-QB injury
effects. Turnovers remain part of EPA; no arbitrary "fluke correction" is applied.
The prior and coefficients are hypotheses to evaluate, not established optimal
values. Any coefficient change requires a new model version.

## Forward evaluation

The Performance panel reports live-versus-trial and live-versus-market on their
respective matched samples. It uses final, genuinely pregame forecasts at the
same capture timestamp. It uses automatic probabilities, excluding discretionary
overrides from both comparisons. Ties, missing quotes, absent trial coverage and
unpaired timestamps do not enter these scores.

Market differences of at least 10 percentage points are review flags only.
They do not feed the model or override picks. Market observations are labeled
as prices at forecast time, not guaranteed closing prices. There is no automatic
promotion rule: review Brier/log loss, calibration, coverage and performance
across weeks before deciding to replace 2026.5.

## Validation on October 13

- First source retrieval: 13,842 rows; 156 team-game observations from 78 games,
  all 32 teams. Monday's game was still inside the 24-hour ingestion delay.
- Strict historical replay: **zero** eligible pairs, correctly reflecting that
  these efficiency observations were first collected today.
- An explicitly hypothetical replay assumes each currently revised game's data
  was available 24 hours after kickoff. It uses existing pregame capture times,
  excludes ties/manual overrides, and does not reconstruct historical QB feeds.
  On 46 eligible games, both versions picked 31 winners. Live Brier 0.217218;
  trial Brier 0.218925. Live log loss 0.622255; trial 0.626354. This is **not**
  a leakage-free historical backtest and shows no improvement. No parameters
  were tuned to these results. The trial remains observational.
- Tests cover revisions/cutoffs, invalid/partial data, team aliases, shrinkage,
  preservation of QB effects, pregame-only odds, stale odds, same-time pairing,
  immutable capture and exclusion of the trial from published selections.

Replay command:

```sh
node --import tsx scripts/replay-efficiency.ts archive.json observations.json
# Diagnostic only; explicitly assumes unavailable historical publication times:
node --import tsx scripts/replay-efficiency.ts archive.json observations.json --assume-24h
```

## Operations and access

New observations and market rows are public read-only sports data. RLS and
grants prevent client writes; server-side collection uses the existing admin
client. Database triggers reject updates/deletions to immutable histories.
The Performance panel exposes collection counts, refresh state and missing-data
warnings. Core result collection and live forecast generation continue if the
efficiency provider is unavailable. Source refresh status is stored separately
from prediction accuracy.
