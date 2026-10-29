"""Rebuild Draft Duel from nflverse REG season totals. Python standard library only.
Usage: python scripts/build-draft-duel.py [cache-directory]
Never uses the incomplete current season. Source URLs and hashes are committed.
"""
import concurrent.futures
import csv
import hashlib
import io
import json
import pathlib
import sys
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
CACHE = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/draft-duel-source')
CACHE.mkdir(parents=True, exist_ok=True)
YEARS = range(2000, 2026)
ALIASES = {'SD': 'LAC', 'STL': 'LAR', 'LA': 'LAR', 'OAK': 'LV', 'WAS': 'WSH'}
TEAMS = dict(zip('ARI ATL BAL BUF CAR CHI CIN CLE DAL DEN DET GB HOU IND JAX KC LAC LAR LV MIA MIN NE NO NYG NYJ PHI PIT SEA SF TB TEN WSH'.split(),
 ['Cardinals','Falcons','Ravens','Bills','Panthers','Bears','Bengals','Browns','Cowboys','Broncos','Lions','Packers','Texans','Colts','Jaguars','Chiefs','Chargers','Rams','Raiders','Dolphins','Vikings','Patriots','Saints','Giants','Jets','Eagles','Steelers','Seahawks','49ers','Buccaneers','Titans','Commanders']))

def fetch(item):
    name, url = item
    path = CACHE / name
    if not path.exists():
        with urllib.request.urlopen(url, timeout=90) as response:
            path.write_bytes(response.read())
    data = path.read_bytes()
    return name, list(csv.DictReader(io.StringIO(data.decode('utf-8-sig')))), {'file': name, 'url': url, 'sha256': hashlib.sha256(data).hexdigest()}

def n(row, key):
    value = row.get(key, '')
    return float(value) if value not in ('', 'NA', None) else 0

def offense(r):
    # Explicit uniform scoring; no dependence on provider fantasy-score conventions.
    return (n(r,'passing_yards')/25 + n(r,'passing_tds')*4 - n(r,'passing_interceptions')*2
            + (n(r,'rushing_yards')+n(r,'receiving_yards'))/10 + n(r,'receptions')
            + 6*(n(r,'rushing_tds')+n(r,'receiving_tds'))
            - 2*(n(r,'sack_fumbles_lost')+n(r,'rushing_fumbles_lost')+n(r,'receiving_fumbles_lost'))
            + 2*(n(r,'passing_2pt_conversions')+n(r,'rushing_2pt_conversions')+n(r,'receiving_2pt_conversions')))

def kicking(r):
    return (3*sum(n(r,k) for k in ['fg_made_0_19','fg_made_20_29','fg_made_30_39'])
            +4*n(r,'fg_made_40_49')+5*(n(r,'fg_made_50_59')+n(r,'fg_made_60_'))+n(r,'pat_made'))

def allowed_points(points):
    for maximum, score in [(0,10),(6,7),(13,4),(20,1),(27,0),(34,-1),(1000,-4)]:
        if points <= maximum:
            return score
    raise ValueError(points)

if __name__ == '__main__':
    jobs = [(f'{kind}_reg_{year}.csv',f'https://github.com/nflverse/nflverse-data/releases/download/{kind}/{kind}_reg_{year}.csv') for year in YEARS for kind in ['stats_player','stats_team']]
    jobs.append(('games.csv','https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv'))
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        fetched = list(pool.map(fetch, jobs))
    files = {name: rows for name, rows, _ in fetched}
    best = {}
    floors = {'QB':8, 'RB':5, 'WR':5, 'TE':3, 'K':4}
    for year in YEARS:
        for r in files[f'stats_player_reg_{year}.csv']:
            pos = r['position']
            games = int(n(r,'games'))
            if pos not in floors or games < 8:
                continue
            points = kicking(r) if pos == 'K' else offense(r)
            team = ALIASES.get(r['recent_team'],r['recent_team'])
            if team not in TEAMS:
                raise ValueError(f'Unknown team: {team}')
            card = dict(id=r['player_id'], name=r['player_display_name'], position=pos, team=team, season=year, games=games,
                        points=round(points,2), average=round(points/games,2))
            key = card['id']
            # Compare unrounded scores. Ties prefer the longer season, then earlier year.
            rank = (points/games,games,-year)
            if key not in best or rank > best[key][0]:
                best[key] = (rank,card)
    # Curated breadth: top six and up to four lower-scoring alternatives per team/position.
    groups = defaultdict(list)
    for _, card in best.values():
        if card['average'] >= floors[card['position']]:
            groups[(card['team'],card['position'])].append(card)
    cards = []
    for group in groups.values():
        group.sort(key=lambda c: (-c['average'],c['id']))
        chosen = group[:6]
        rest = group[6:]
        if rest:
            chosen += [rest[i] for i in sorted(set(round(i*(len(rest)-1)/3) for i in range(4)))]
        cards += chosen
    defense_best = {}
    for year in YEARS:
        schedule = [g for g in files['games.csv'] if g['season']==str(year) and g['game_type']=='REG']
        for r in files[f'stats_team_reg_{year}.csv']:
            team = ALIASES.get(r['team'],r['team'])
            games = [g for g in schedule if team in [ALIASES.get(g['home_team'],g['home_team']),ALIASES.get(g['away_team'],g['away_team'])]]
            assert len(games) >= 14, (team,year,len(games))
            pa = sum(allowed_points(float(g['away_score'] if ALIASES.get(g['home_team'],g['home_team'])==team else g['home_score'])) for g in games)
            points = n(r,'def_sacks')+2*(n(r,'def_interceptions')+n(r,'fumble_recovery_opp')+n(r,'def_safeties'))+6*(n(r,'def_tds')+n(r,'special_teams_tds'))+pa
            card = dict(id='dst-'+team,name=TEAMS[team]+' D/ST',position='DST',team=team,season=year,games=len(games),points=round(points,2),average=round(points/len(games),2))
            if team not in defense_best or points/len(games)>defense_best[team][0]:
                defense_best[team]=(points/len(games),card)
    cards += [card for _,card in defense_best.values()]
    assert len({c['id'] for c in cards}) == len(cards)
    assert set(c['team'] for c in cards) == set(TEAMS)
    cards.sort(key=lambda c:(c['team'],c['position'],-c['average'],c['id']))
    out = {'version':'1','firstSeason':2000,'lastSeason':2025,'minimumGames':8,'teams':TEAMS,'cards':cards}
    (ROOT/'src/data/draft-duel.json').write_text(json.dumps(out,separators=(',',':'))+'\n')
    (ROOT/'docs/draft-duel-sources.json').write_text(json.dumps({'retrievedAt':datetime.now(timezone.utc).isoformat(),'sources':[m for _,_,m in fetched]},indent=2)+'\n')
    print('Generated',len(cards),'cards across',len(TEAMS),'franchises.', flush=True)
    print(json.dumps([c for c in cards if c['name'] in ['Tom Brady','Randy Moss','Josh Allen','LaDainian Tomlinson']],indent=2))
