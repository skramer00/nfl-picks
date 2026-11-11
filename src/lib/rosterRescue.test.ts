import test from 'node:test';
import assert from 'node:assert/strict';
import {CARDS} from './draftDuel';
import roster from '../data/rescue-roster.json';
import {RESCUE_CARDS,makePuzzle,validRoster,solvePuzzle,total,changes,replaceCard,restoreRescue,rescueDailySeed,allowedRoster,combinations} from './rosterRescue';
test('rescue pools are deterministic, curated and contain nine starters and twelve alternatives',()=>{
  const approved=new Set(RESCUE_CARDS.map(c=>c.id));
  for(let i=0;i<100;i++){
    const p=makePuzzle('rescue-v2-test-'+i);
    assert.ok(validRoster(p.starters));assert.equal(p.bench.length,12);
    assert.equal(new Set([...p.starters,...p.bench].map(c=>c.id)).size,21);
    assert.ok([...p.starters,...p.bench].every(c=>approved.has(c.id)));
    const best=solvePuzzle(p);assert.ok(allowedRoster(p,best));assert.ok(total(best)>total(p.starters));
  }
  assert.deepEqual(makePuzzle('same'),makePuzzle('same'));
});
test('solver agrees with an independent exhaustive roster search on a small fixture',()=>{
  const p=makePuzzle('rescue-v2-fixture');p.bench=p.bench.slice(0,5);
  const options=combinations([...p.starters,...p.bench],9).filter(c=>allowedRoster(p,c));
  assert.equal(total(solvePuzzle(p)),Math.max(...options.map(total)));
});
test('swap budget, duplicate restrictions and required positions are enforced',()=>{
  const p=makePuzzle('rescue-v2-budget');let cards=p.starters;
  for(let i=0;i<3;i++){
    const out=cards.find(c=>p.starters.includes(c)&&p.bench.some(b=>b.position===c.position&&!cards.includes(b)))!;
    const incoming=p.bench.find(c=>c.position===out.position&&!cards.includes(c))!;
    cards=replaceCard(p,cards,out.id,incoming.id)!;
  }
  assert.equal(changes(p,cards),3);
  for(const old of cards.filter(c=>p.starters.includes(c)))for(const incoming of p.bench.filter(c=>!cards.includes(c)))assert.equal(replaceCard(p,cards,old.id,incoming.id),null);
  assert.equal(replaceCard(p,cards,cards[0].id,cards[1].id),null);
  const newcomer=cards.find(c=>p.bench.includes(c))!;const original=p.starters.find(c=>c.position===newcomer.position&&!cards.includes(c))!;
  const reverted=replaceCard(p,cards,newcomer.id,original.id)!;assert.ok(reverted);assert.equal(changes(p,reverted),2);
});
test('save restore rejects forged rosters and preserves submitted daily state',()=>{
  const seed=rescueDailySeed(new Date('2026-11-12T07:59:59Z'));assert.equal(seed,'rescue-v2-daily-2026-11-11');
  assert.equal(rescueDailySeed(new Date('2026-11-12T08:00:00Z')),'rescue-v2-daily-2026-11-12');
  const p=makePuzzle(seed);const save={seed,mode:'daily',ids:solvePuzzle(p).map(c=>c.id),submitted:true};
  assert.deepEqual(restoreRescue(save)?.save,save);
  assert.equal(restoreRescue({...save,ids:Array(9).fill(p.starters[0].id)}),null);
  assert.equal(restoreRescue({...save,ids:['fake',...save.ids.slice(1)]}),null);
  assert.equal(restoreRescue({...save,submitted:'yes'}),null);
});

test('current pool uses roster identity and current teams without changing historical scores',()=>{
  const players=roster.players as Record<string,{team:string;status:string}>;
  assert.ok(RESCUE_CARDS.some(c=>players[c.id]?.status==='RES'));
  assert.equal(RESCUE_CARDS.filter(c=>c.position==='DST').length,32);
  for(const c of RESCUE_CARDS){
    const original=CARDS.find(x=>x.id===c.id)!;
    assert.deepEqual({...c,team:original.team},original);
    if(c.position!=='DST'){assert.ok(players[c.id]);assert.equal(c.team,players[c.id].team);}
  }
  assert.ok(!RESCUE_CARDS.some(c=>['Tom Brady','Randy Moss','LaDainian Tomlinson'].includes(c.name)));
  assert.equal(restoreRescue({seed:'rescue-v1-daily-2026-11-11',mode:'daily',ids:[],submitted:true}),null);
});
