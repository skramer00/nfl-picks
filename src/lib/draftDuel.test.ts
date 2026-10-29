import exclusions from '../data/draft-duel-exclusions.json';
import test from 'node:test';
import assert from 'node:assert/strict';
import { CARDS, TEAMS, POOL_COUNTS, POSITIONS, generatePool, random, dailySeed, startDuel, draftCard, legalCards, roster, score, canAdd, restoreDuel, sideAt, lineup, chooseComputer } from './draftDuel';

test('catalog has unique players, 32 defenses, eligible seasons and reproducible rounded averages',()=>{
  assert.equal(new Set(CARDS.map(c=>c.id)).size,CARDS.length);
  assert.equal(CARDS.filter(c=>c.position==='DST').length,32);
  for(const c of CARDS){assert.ok(c.games>=8);assert.ok(c.season>=2000&&c.season<=2025);assert.ok(TEAMS[c.team]);assert.ok(Math.abs(c.average-c.points/c.games)<=.00501);}
  const lt=CARDS.find(c=>c.name==='LaDainian Tomlinson')!;
  assert.equal(lt.season,2006);assert.equal(lt.average,30.07);assert.equal(lt.team,'LAC');
  assert.equal(CARDS.find(c=>c.name==='Randy Moss')?.season,2007);
});
test('500 random pools meet exact position quotas and one card per franchise',()=>{
  for(let i=0;i<500;i++){
    const pool=generatePool('coverage-'+i);
    assert.equal(pool.length,32);assert.equal(new Set(pool.map(c=>c.team)).size,32);assert.equal(new Set(pool.map(c=>c.id)).size,32);
    for(const p of POSITIONS)assert.equal(pool.filter(c=>c.position===p).length,POOL_COUNTS[p]);
  }
  assert.deepEqual(generatePool('same'),generatePool('same'));
  assert.notDeepEqual(generatePool('same'),generatePool('other'));
});
test('snake order alternates consecutive picks and gives both sides nine',()=>{
  assert.deepEqual(Array.from({length:8},(_,i)=>sideAt(i,'you')),['you','cpu','cpu','you','you','cpu','cpu','you']);
  for(const first of ['you','cpu'] as const)assert.equal(Array.from({length:18},(_,i)=>sideAt(i,first)).filter(s=>s==='you').length,9);
});
test('random human picks and computer strategy always finish valid complete rosters',()=>{
  for(let i=0;i<60;i++){
    let game=startDuel('playthrough-'+i,'practice');const rng=random('human-'+i);
    while(game.picks.length<18){
      const choices=legalCards(game);assert.ok(choices.length);
      const before=game.picks.length;game=draftCard(game,choices[Math.floor(rng()*choices.length)].id);assert.ok(game.picks.length>before);
    }
    assert.equal(new Set(game.picks).size,18);
    for(const side of ['you','cpu'] as const){
      const cards=roster(game,side);assert.equal(cards.length,9);assert.ok(lineup(cards).every(s=>s.card));
      assert.equal(score(cards),cards.reduce((sum,c)=>sum+Math.round(c.average*100),0)/100);
    }
    if(i<4)assert.deepEqual(restoreDuel({seed:game.seed,mode:game.mode,picks:game.picks}),game);
  }
});
test('flex can use only one excess skill player and cannot strand required positions',()=>{
  const rb=CARDS.filter(c=>c.position==='RB').slice(0,4),te=CARDS.filter(c=>c.position==='TE').slice(0,2);
  assert.ok(canAdd(rb.slice(0,2),rb[2]));assert.equal(canAdd(rb.slice(0,3),rb[3]),false);
  assert.equal(canAdd([...rb.slice(0,3),te[0]],te[1]),false);
  assert.equal(canAdd([rb[0]],rb[0]),false);
});
test('illegal picks and tampered save files cannot change a draft',()=>{
  const game=startDuel('save-check','practice');assert.equal(draftCard(game,'made-up-id'),game);
  assert.equal(restoreDuel({seed:game.seed,mode:'practice',picks:['fake']}),null);
  assert.equal(restoreDuel({seed:game.seed,mode:'unknown',picks:[]}),null);
  assert.equal(restoreDuel(null),null);
  assert.deepEqual(restoreDuel(game),game);
});
test('daily seed changes at Los Angeles midnight, including daylight saving time',()=>{
  assert.equal(dailySeed(new Date('2026-10-29T06:59:59Z')),'daily-v2-2026-10-28');
  assert.equal(dailySeed(new Date('2026-10-29T07:00:00Z')),'daily-v2-2026-10-29');
  assert.equal(dailySeed(new Date('2026-12-01T07:59:59Z')),'daily-v2-2026-11-30');
});

test('curation excludes stable IDs without excluding unrelated namesakes',()=>{
  for(const entry of exclusions.players)assert.ok(!CARDS.some(c=>c.id===entry.id),entry.name);
  assert.ok(CARDS.some(c=>c.id==='00-0021306')); // Bears Adrian Peterson
  assert.ok(CARDS.some(c=>c.id==='00-0036252')); // Colts Michael Pittman
});
test('CPU never chooses a lower-valued available card at the same position',()=>{
  for(let i=0;i<20;i++){
    let game={seed:'dominance-'+i,mode:'practice' as const,first:'cpu' as const,pool:generatePool('dominance-'+i),picks:[] as string[]};
    while(game.picks.length<18){
      const legal=legalCards(game);
      const card=sideAt(game.picks.length,game.first)==='cpu'?chooseComputer(game):legal[0];
      if(sideAt(game.picks.length,game.first)==='cpu')assert.equal(card.average,Math.max(...legal.filter(c=>c.position===card.position).map(c=>c.average)));
      game={...game,picks:[...game.picks,card.id]};
    }
  }
});
