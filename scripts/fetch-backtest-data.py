"""Prepare public nflverse schedule/results for backtest-model.ts; stdout is JSON."""
import csv, io, json, sys, urllib.request
from datetime import datetime
from zoneinfo import ZoneInfo
url = 'https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv'
text = open(sys.argv[1]).read() if len(sys.argv) > 1 else urllib.request.urlopen(url).read().decode()
alias = {'LA': 'LAR', 'STL': 'LAR', 'SD': 'LAC', 'OAK': 'LV', 'WAS': 'WSH'}
rows = []
for row in csv.DictReader(io.StringIO(text)):
    if row['game_type'] != 'REG' or not 2010 <= int(row['season']) <= 2025 or not row['home_score'] or not row['away_score']:
        continue
    kickoff = datetime.fromisoformat(row['gameday'] + 'T' + (row['gametime'] or '13:00')).replace(tzinfo=ZoneInfo('America/New_York'))
    rows.append(dict(season=int(row['season']), week=int(row['week']), kickoff=kickoff.astimezone(ZoneInfo('UTC')).isoformat(),
        away=alias.get(row['away_team'], row['away_team']), home=alias.get(row['home_team'], row['home_team']),
        awayScore=int(row['away_score']), homeScore=int(row['home_score']), neutral=row['location'] == 'Neutral',
        homeRest=float(row['home_rest'] or 7), awayRest=float(row['away_rest'] or 7)))
json.dump(rows, sys.stdout)
