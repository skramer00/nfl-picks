import { CARDS, POSITIONS, random, dailySeed, type Card, type Position } from './draftDuel';
export const RESCUE_STORAGE = 'pretzel-roster-rescue-v1';
export type Puzzle = { seed:string; starters:Card[]; bench:Card[] };
export type RescueSave = { seed:string; mode:'daily'|'practice'; ids:string[]; submitted:boolean };
const cents=(c:Card)=>Math.round(c.average*100);
export const total=(cards:Card[])=>cards.reduce((sum,c)=>sum+cents(c),0)/100;
export const rescueDailySeed=(date:Date)=>dailySeed(date).replace('daily-v2-','rescue-v1-daily-');
export function validRoster(cards:Card[]) {
  if(cards.length!==9||new Set(cards.map(c=>c.id)).size!==9)return false;
  const n=(p:Position)=>cards.filter(c=>c.position===p).length;
  return n('QB')===1&&n('K')===1&&n('DST')===1&&n('RB')>=2&&n('WR')>=2&&n('TE')>=1;
}
/** Every puzzle includes multiple potential upgrades. The bench is shared across
 * starting slots, so RB/WR/TE and FLEX compete for the same replacement cards. */
export function makePuzzle(seed:string):Puzzle {
  const rng=random(seed);const used=new Set<string>();const starters:Card[]=[];const bench:Card[]=[];
  const take=(pool:Card[])=>{const options=pool.filter(c=>!used.has(c.id));const card=options[Math.floor(rng()*options.length)];if(!card)throw Error('Catalog too small');used.add(card.id);return card;};
  const flex=(['RB','WR','TE'] as Position[])[Math.floor(rng()*3)];
  for(const p of POSITIONS){
    const group=CARDS.filter(c=>c.position===p).sort((a,b)=>a.average-b.average||a.id.localeCompare(b.id));
    const count=p==='RB'||p==='WR'?2:1;
    for(let i=0;i<count+(p===flex?1:0);i++)starters.push(take(group.slice(Math.floor(group.length*.2),Math.ceil(group.length*.65))));
    // One strong option and one midrange option per position. Values are visible.
    bench.push(take(group.slice(Math.floor(group.length*.75))));
    bench.push(take(group.slice(Math.floor(group.length*.4),Math.ceil(group.length*.85))));
  }
  return {seed,starters,bench:bench.sort((a,b)=>b.average-a.average||a.id.localeCompare(b.id))};
}
export function changes(p:Puzzle,cards:Card[]) {const original=new Set(p.starters.map(c=>c.id));return cards.filter(c=>!original.has(c.id)).length;}
export function allowedRoster(p:Puzzle,cards:Card[]) {const ids=new Set([...p.starters,...p.bench].map(c=>c.id));return validRoster(cards)&&cards.every(c=>ids.has(c.id))&&changes(p,cards)<=3;}
export function replaceCard(p:Puzzle,cards:Card[],out:string,incoming:string):Card[]|null {
  const replacement=[...p.starters,...p.bench].find(c=>c.id===incoming);
  if(!replacement||!cards.some(c=>c.id===out)||cards.some(c=>c.id===incoming))return null;
  const next=cards.map(c=>c.id===out?replacement:c);return allowedRoster(p,next)?next:null;
}
export function combinations<T>(items:T[],count:number):T[][] {
  if(count===0)return [[]];const out:T[][]=[];
  for(let i=0;i<=items.length-count;i++)for(const tail of combinations(items.slice(i+1),count-1))out.push([items[i],...tail]);
  return out;
}
/** Exact enumeration of every legal roster reachable with 0–3 substitutions.
 * Integer scores keep optimal comparisons identical to displayed totals. */
export function solvePuzzle(p:Puzzle):Card[] {
  let best=p.starters;let value=best.reduce((s,c)=>s+cents(c),0);
  for(let count=1;count<=3;count++){
    const additions=combinations(p.bench,count);
    for(const removed of combinations(p.starters,count)){
      const keep=p.starters.filter(c=>!removed.includes(c));
      for(const added of additions){
        const candidate=[...keep,...added];const score=candidate.reduce((s,c)=>s+cents(c),0);
        if(score>value&&validRoster(candidate)){best=candidate;value=score;}
      }
    }
  }
  return best;
}
export function restoreRescue(raw:unknown):{save:RescueSave;puzzle:Puzzle;cards:Card[]}|null {
  if(!raw||typeof raw!=='object')return null;
  const r=raw as RescueSave;
  if(typeof r.seed!=='string'||r.seed.length>100||!r.seed.startsWith('rescue-v1-')||!['daily','practice'].includes(r.mode)||typeof r.submitted!=='boolean'||!Array.isArray(r.ids)||r.ids.length!==9)return null;
  if(r.mode==='daily'&&!/^rescue-v1-daily-\d{4}-\d{2}-\d{2}$/.test(r.seed))return null;
  const puzzle=makePuzzle(r.seed);const all=[...puzzle.starters,...puzzle.bench];const cards=r.ids.map(id=>all.find(c=>c.id===id));
  if(cards.some(c=>!c)||!allowedRoster(puzzle,cards as Card[]))return null;
  return {save:{seed:r.seed,mode:r.mode,submitted:r.submitted,ids:[...r.ids]},puzzle,cards:cards as Card[]};
}
