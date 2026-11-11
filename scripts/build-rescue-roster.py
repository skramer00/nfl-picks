"""Refresh Rescue eligibility; review diff and bump seed/storage version before release.
Usage: python scripts/build-rescue-roster.py --season 2026
Only active/inactive/reserve roster players qualify (not practice squad/free agents).
"""
import argparse, csv, io, json, pathlib, urllib.request, collections
p = argparse.ArgumentParser()
p.add_argument('--season', type=int, required=True)
a = p.parse_args()
root = pathlib.Path(__file__).resolve().parents[1]
url = 'https://api.github.com/repos/nflverse/nflverse-data/releases/tags/rosters'
release = json.load(urllib.request.urlopen(url))
asset = next(x for x in release['assets'] if x['name'] == f'roster_{a.season}.csv')
rows = list(csv.DictReader(io.StringIO(urllib.request.urlopen(asset['browser_download_url']).read().decode())))
normalize = {'LA':'LAR','STL':'LAR','SD':'LAC','OAK':'LV','WAS':'WSH'}
players = {}
for r in rows:
    if r['status'] not in {'ACT','INA','RES'} or r['status_description_abbr'] == 'W03' or not r['gsis_id']:
        continue
    entry = {'team':normalize.get(r['team'],r['team']), 'status':r['status']}
    if r['gsis_id'] in players and players[r['gsis_id']] != entry:
        raise ValueError('Ambiguous current roster: '+r['gsis_id'])
    players[r['gsis_id']] = entry
catalog = json.loads((root/'src/data/draft-duel.json').read_text())
excluded = {x['id'] for x in json.loads((root/'src/data/draft-duel-exclusions.json').read_text())['players']}
players = {k:v for k,v in sorted(players.items()) if k not in excluded and any(c['id']==k for c in catalog['cards'])}
counts = collections.Counter(c['position'] for c in catalog['cards'] if c['id'] in players)
assert all(counts[p] >= 12 for p in ['QB','RB','WR','TE','K']), counts
assert all(v['team'] in catalog['teams'] for v in players.values())
out = {'season':a.season,'asOf':asset['updated_at'][:10], 'sourceUpdatedAt':asset['updated_at'],'source':asset['browser_download_url'],'players':players}
(root/'src/data/rescue-roster.json').write_text(json.dumps(out,indent=2)+'\n')
print(len(players),dict(counts),out['asOf'])
