#!/usr/bin/env python3
"""Extract auditable team EPA and success-rate inputs from nflverse play-by-play."""

import csv
import gzip
import json
import sys
import urllib.request
from collections import defaultdict
from pathlib import Path

SEASON = 2025
URL = f"https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_{SEASON}.csv.gz"
OUTPUT = Path("src/data/model_play_efficiency_2025.json")


def normalize(team: str) -> str:
    aliases = {"WAS": "WSH", "LA": "LAR"}
    return aliases.get(team, team)


def source():
    if len(sys.argv) > 1:
        return gzip.open(sys.argv[1], "rt", newline="")
    return gzip.open(urllib.request.urlopen(URL), "rt", newline="")


totals = defaultdict(lambda: {
    "offensivePlays": 0,
    "offensiveEpa": 0.0,
    "offensiveSuccesses": 0,
    "defensivePlays": 0,
    "defensiveEpaAllowed": 0.0,
    "defensiveSuccessesAllowed": 0,
})

with source() as handle:
    for play in csv.DictReader(handle):
        if play["season_type"] != "REG" or play["play_type"] not in {"pass", "run"}:
            continue
        if play["special_teams_play"] == "1" or play["qb_kneel"] == "1" or play["qb_spike"] == "1":
            continue
        if not play["posteam"] or not play["defteam"] or not play["epa"]:
            continue
        offense = normalize(play["posteam"])
        defense = normalize(play["defteam"])
        epa = float(play["epa"])
        success = 1 if play["success"] == "1" else 0
        totals[offense]["offensivePlays"] += 1
        totals[offense]["offensiveEpa"] += epa
        totals[offense]["offensiveSuccesses"] += success
        totals[defense]["defensivePlays"] += 1
        totals[defense]["defensiveEpaAllowed"] += epa
        totals[defense]["defensiveSuccessesAllowed"] += success

teams = []
for team, values in totals.items():
    teams.append({
        "abbreviation": team,
        "offensivePlays": values["offensivePlays"],
        "offensiveEpaPerPlay": round(values["offensiveEpa"] / values["offensivePlays"], 4),
        "offensiveSuccessRate": round(values["offensiveSuccesses"] / values["offensivePlays"], 4),
        "defensivePlays": values["defensivePlays"],
        "defensiveEpaAllowedPerPlay": round(values["defensiveEpaAllowed"] / values["defensivePlays"], 4),
        "defensiveSuccessRateAllowed": round(values["defensiveSuccessesAllowed"] / values["defensivePlays"], 4),
    })

document = {
    "season": SEASON,
    "generatedAt": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
    "source": URL,
    "license": "CC-BY-4.0 / nflverse and nflfastR",
    "filters": "Regular-season pass and run plays; excludes special teams, kneels, and spikes.",
    "teams": sorted(teams, key=lambda item: item["abbreviation"]),
}
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_text(json.dumps(document, indent=2) + "\n")
print(f"Generated {len(teams)} team efficiency rows in {OUTPUT}.")
