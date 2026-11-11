# Roster Rescue

Solo daily/practice puzzle at `/roster-rescue`, reusing Draft Duel’s curated catalog, exclusions and scoring. Nine starters and twelve unique bench players; one stronger and one midrange bench option at each position. Starting cards are sampled from the lower-middle scoring range, with a random skill-position FLEX. Unlike Draft Duel, this game does not limit franchises.

The player can experiment freely and undo/reset before submitting. The three-swap limit counts distinct bench players in the current lineup, not clicks. Returning a starter refunds that slot. Each intermediate and final roster must remain legal; FLEX is reassigned automatically. Submission locks that attempt and reveals one exact optimum over every choice of up to three removals and additions. Scores use integer hundredths, and the result measures captured improvement, not total-score percentage. A zero-swap submission is allowed.

Daily seeds reset at Los Angeles midnight. Browser-only versioned storage keeps the active attempt and up to forty completed results; there is no account leaderboard, cross-device sync or anti-cheat claim. Practice has unlimited random seeds. Stored rosters are reconstructed and validated against the seeded catalog. Future pool/rules changes require a seed/storage version bump. Completed daily attempts reopen as results; unfinished attempts may be replaced after an inline confirmation.

Checks cover 100 seeds, unique eligible cards, complete roster requirements, positive achievable improvement, exact solver agreement with independent enumeration, budget/refund/duplicate constraints, malformed saves, and daily rollover. UI provides keyboard-operable roster selections, focus handoff, explicit live updates, high contrast, mobile layouts and clipboard fallback.

## Current-player eligibility
Roster Rescue alone filters the curated catalog through `src/data/rescue-roster.json`, a dated nflverse current-season roster snapshot. Active, inactive and reserve players qualify, including IR; released, retired, practice-squad and ambiguous roster entries do not. Existing exclusions still apply. Rookies without a completed eligible season are absent. All 32 franchise D/ST cards retain their historical best season. Scores remain unchanged; current team replaces the historical team for display, with scoring-team attribution on bench cards.

Refresh with `python scripts/build-rescue-roster.py --season 2026`; inspect eligibility/team changes and bump both seed and storage versions before deploying, so saved puzzles cannot silently change. This is a published snapshot, not a live roster sync. Version 2 retires historical-pool saves and explains the reset in the UI. Draft Duel catalog, scoring and saves are unchanged.
