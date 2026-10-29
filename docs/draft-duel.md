# Draft Duel v1

An anytime, guest-friendly game at `/draft-duel`. A 32-card pool contains exactly
one card from each current franchise (historical cities are normalized), including
4 QB, 8 RB, 10 WR, 4 TE, 3 K and 3 D/ST. Nine picks per side fill QB/RB/RB/WR/WR/TE/
FLEX/K/DST. A seeded coin flip selects first pick; a snake draft alternates rounds.
The computer simulates the remainder of the draft for each legal candidate using
a positional-scarcity heuristic for both sides. It chooses the best resulting
score margin. This is deterministic, not guaranteed optimal, and has no hidden data.

## Historical data

`python scripts/build-draft-duel.py` downloads nflverse seasonal REG player and
team statistics for 2000–2025 and nflverse/nfldata schedules. It computes fantasy
scores explicitly, chooses each player's maximum **unrounded** points per source
game with at least 8 recorded games (ties: more games, then earlier year), then
curates that player's single best card. The offense pool retains a mix of the top
six and up to four lower-ranked cards per franchise/position. Minimum best-season
averages: QB 8, RB/WR 5, TE 3, K 4. No alternate bad-season cards are substituted.

This is the best eligible season **within 2000–2025**, not a claim about seasons
outside that range. Source `games` is the nflverse statistical game count, not
an injury-adjusted snap denominator. Missed games are not zeroes; early exits
still affect the average. Season rows for traded players are credited to their
source `recent_team`; totals include the entire season, which the UI discloses.
No era adjustment. Franchise defense uses its best full regular season.

Scores use full PPR; passing yards /25, passing TD 4, interceptions thrown -2;
rushing/receiving yards /10 and TD 6; offensive lost fumbles -2; all offensive
two-point conversions 2. Individual return TDs are excluded (D/ST gets them).
Kicking: PAT 1; field goals under 40 yards 3, 40–49 4, 50+ 5; no miss penalties.
D/ST: sacks 1; interceptions, opponent fumble recoveries and safeties 2; defensive
and special-teams TD 6. Weekly opponent **whole final score** bonuses: 0 +10,
1–6 +7, 7–13 +4, 14–20 +1, 21–27 0, 28–34 -1, 35+ -4. No yardage or blocked-kick
bonuses. This is an explicit game scoring system, not a claim of identical rules
to any fantasy platform. Card averages are rounded to hundredths; lineup scores
sum those hundredths exactly. Ties remain ties.

Source download URLs and SHA-256 hashes are in `draft-duel-sources.json`.
The small derived catalog is committed in `src/data/draft-duel.json`. nflverse
data attribution and CC BY 4.0 are displayed in-game. Raw downloads stay outside
the repository. This release freezes the source data; it never needs live NFL
feeds, database writes or new credentials during play.

## Persistence and scope

Daily seeds use America/Los_Angeles calendar dates. Practice seeds use browser
UUIDs. Same seed/version yields the same pool, opening side and computer choices.
The game stores a versioned active draft and up to 60 completed drafts in this
browser's localStorage. Restore regenerates the board and computer picks and
validates the human's picks; it does not trust serialized card values. Reopening
a completed daily challenge displays the completed draft. Daily scores are local,
not an authenticated competitive leaderboard. Browser storage failure is surfaced
without blocking play. No signup required; no cloud history or multiplayer yet.

## Validation

Engine tests cover 500 pools, positional quotas, 60 complete randomized human
drafts against the CPU, snake order, unique picks, flexible slot legality, exact
score addition, restored/tampered saves and Los Angeles daily rollover.
The importer rejects missing seasons, unknown franchises and duplicate identities.
Keep original picks, model and survivor features outside this module.

## Curation update — 2026-10-29

Initial targeted review excluded 31 cards. Evidence and precise case descriptions are in `src/data/draft-duel-exclusions.json`. This is editorial selection, not a criminal registry or exhaustive clearance of remaining players. NFL findings, pleas and convictions are distinguished. Animal cruelty is included; rumors and unrelated offenses are not automatic exclusions. Stable IDs prevent confusion between the two Adrian Petersons, Michael Pittman Sr./Jr. and Kellen Winslow II/his father.

The generator excludes those IDs before curation; the game also filters them defensively. Existing dataset has 1,269 cards. Future rebuilds may add replacement cards. Team/position pool quotas remain unchanged.

CPU rollout candidates are limited to the highest available score at each position. Same-position cards have identical eligibility and no franchise bonuses. Version 2 seeds/storage prevent changed catalogs or CPU rules from silently altering old saved drafts; old browser data remains untouched but is not loaded, with a one-time migration notice until the first new save.

At the owner’s direction, documented serious civil allegations can also lead to editorial exclusion. Settlements do not prove wrongdoing; disputed allegations and denials are recorded explicitly.
