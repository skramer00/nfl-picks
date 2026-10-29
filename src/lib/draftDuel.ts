import catalog from '../data/draft-duel.json';
import exclusions from '../data/draft-duel-exclusions.json';

export type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DST';
export type Card = { id: string; name: string; position: Position; team: string; season: number; games: number; points: number; average: number };
export type Side = 'you' | 'cpu';
export type Duel = { seed: string; mode: 'daily' | 'practice'; first: Side; pool: Card[]; picks: string[] };
const excludedIds = new Set(exclusions.players.map(player=>player.id));
export const CARDS = (catalog.cards as Card[]).filter(card=>!excludedIds.has(card.id));
export const TEAMS = catalog.teams as Record<string, string>;
export const POSITIONS: Position[] = ['QB','RB','WR','TE','K','DST'];
export const POOL_COUNTS: Record<Position, number> = { QB:4, RB:8, WR:10, TE:4, K:3, DST:3 };
const BASE: Record<Position, number> = { QB:1, RB:2, WR:2, TE:1, K:1, DST:1 };
export const STORAGE_KEY = 'pretzel-draft-duel-v2';

export function random(seed: string) {
  let state = 2166136261;
  for (let i=0;i<seed.length;i++) state = Math.imul(state ^ seed.charCodeAt(i),16777619);
  return () => { state += 0x6D2B79F5; let t=state; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; };
}
function shuffle<T>(values: T[], rng: () => number): T[] {
  const a=[...values]; for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a;
}
export function dailySeed(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const get=(type:string)=>parts.find(p=>p.type===type)!.value;
  return `daily-v2-${get('year')}-${get('month')}-${get('day')}`;
}

/** Assign each franchise to exactly one position before choosing its card.
 * Backtracking guarantees exact quotas even for sparse historical positions. */
export function generatePool(seed: string): Card[] {
  const rng=random(seed); const remaining={...POOL_COUNTS}; const assignment=new Map<string,Position>();
  const teams=shuffle(Object.keys(TEAMS),rng);
  const options=new Map(teams.map(team=>[team,shuffle(POSITIONS.filter(p=>CARDS.some(c=>c.team===team&&c.position===p)),rng)]));
  function place(todo:string[]):boolean {
    if(!todo.length) return true;
    const team=[...todo].sort((a,b)=>options.get(a)!.filter(p=>remaining[p]>0).length-options.get(b)!.filter(p=>remaining[p]>0).length)[0];
    for(const p of options.get(team)!){
      if(!remaining[p])continue;
      remaining[p]--; assignment.set(team,p);
      const rest=todo.filter(t=>t!==team);
      const feasible=POSITIONS.every(pos=>rest.filter(t=>options.get(t)!.includes(pos)).length>=remaining[pos]);
      if(feasible&&place(rest))return true;
      remaining[p]++;assignment.delete(team);
    }
    return false;
  }
  if(!place(teams))throw new Error('The historical catalog cannot fill this pool.');
  return teams.map(team=>{
    const choices=CARDS.filter(c=>c.team===team&&c.position===assignment.get(team));
    return choices[Math.floor(rng()*choices.length)];
  });
}
export function sideAt(index:number,first:Side):Side {
  const leads=index%4===0||index%4===3;
  return leads?first:first==='you'?'cpu':'you';
}
export function roster(duel:Duel,side:Side):Card[] {
  return duel.picks.filter((_,i)=>sideAt(i,duel.first)===side).map(id=>duel.pool.find(c=>c.id===id)!);
}
export function canAdd(cards:Card[],card:Card):boolean {
  if(cards.length>=9||cards.some(c=>c.id===card.id))return false;
  const all=[...cards,card];
  const counts=Object.fromEntries(POSITIONS.map(p=>[p,all.filter(c=>c.position===p).length])) as Record<Position,number>;
  if(counts.QB>1||counts.K>1||counts.DST>1)return false;
  return ['RB','WR','TE'].reduce((sum,p)=>sum+Math.max(0,counts[p as Position]-BASE[p as Position]),0)<=1;
}
export function legalCards(duel:Duel):Card[] {
  if(duel.picks.length>=18)return [];
  const mine=roster(duel,sideAt(duel.picks.length,duel.first));
  return duel.pool.filter(c=>!duel.picks.includes(c.id)&&canAdd(mine,c));
}
/** Score in integer hundredths: the visible card values always sum exactly. */
export function score(cards:Card[]):number { return cards.reduce((n,c)=>n+Math.round(c.average*100),0)/100; }
export function chooseGreedy(duel:Duel):Card {
  const legal=legalCards(duel);
  if(!legal.length)throw new Error('No legal pick.');
  const side=sideAt(duel.picks.length,duel.first);
  const mine=roster(duel,side), theirs=roster(duel,side==='cpu'?'you':'cpu');
  const available=duel.pool.filter(c=>!duel.picks.includes(c.id));
  const value=(c:Card)=>{
    const same=available.filter(x=>x.position===c.position).sort((a,b)=>b.average-a.average);
    const needed=Math.max(0,BASE[c.position]-mine.filter(x=>x.position===c.position).length);
    const rivalNeed=Math.max(0,BASE[c.position]-theirs.filter(x=>x.position===c.position).length);
    const replacement=same[Math.min(same.length-1,Math.max(1,needed+rivalNeed-1))]?.average??0;
    return (c.average-replacement)*2+c.average*.15;
  };
  return [...legal].sort((a,b)=>value(b)-value(a)||b.average-a.average||a.id.localeCompare(b.id))[0];
}
/** Deterministic full-draft rollout per candidate. Both sides follow the same
 * scarcity heuristic in the rollout; CPU cannot see information the user lacks. */
export function chooseComputer(duel:Duel):Card {
  let best:Card|undefined;let bestMargin=-Infinity;
  const legal=legalCards(duel);
  // Same-position cards have identical eligibility. Never let rollout artifacts
  // prefer a strictly lower score; there are no team bonuses or salary costs.
  const candidates=legal.filter(card=>!legal.some(other=>other.position===card.position&&other.average>card.average));
  for(const card of candidates){
    const trial={...duel,picks:[...duel.picks,card.id]};
    while(trial.picks.length<18)trial.picks.push(chooseGreedy(trial).id);
    const margin=score(roster(trial,'cpu'))-score(roster(trial,'you'));
    if(margin>bestMargin){best=card;bestMargin=margin;}
  }
  if(!best)throw new Error('No legal computer pick.');
  return best;
}
export function advanceComputer(duel:Duel):Duel {
  const next={...duel,picks:[...duel.picks]};
  while(next.picks.length<18&&sideAt(next.picks.length,next.first)==='cpu') next.picks.push(chooseComputer(next).id);
  return next;
}
export function startDuel(seed:string,mode:Duel['mode']):Duel {
  return advanceComputer({seed,mode,first:random(seed+'-order')()<.5?'you':'cpu',pool:generatePool(seed),picks:[]});
}
export function draftCard(duel:Duel,id:string):Duel {
  if(sideAt(duel.picks.length,duel.first)!=='you'||!legalCards(duel).some(c=>c.id===id))return duel;
  return advanceComputer({...duel,picks:[...duel.picks,id]});
}
export function lineup(cards:Card[]) {
  const remaining=[...cards];
  const slots=['QB','RB','RB','WR','WR','TE','FLEX','K','DST'];
  return slots.map(slot=>{
    const index=remaining.findIndex(c=>slot==='FLEX'?['RB','WR','TE'].includes(c.position):c.position===slot);
    return {slot,card:index<0?undefined:remaining.splice(index,1)[0]};
  });
}
export function restoreDuel(value:unknown):Duel|null {
  if(!value||typeof value!=='object')return null;
  const raw=value as Record<string,unknown>;
  if(typeof raw.seed!=='string'||raw.seed.length>100||!['daily','practice'].includes(String(raw.mode))||!Array.isArray(raw.picks)||raw.picks.length>18)return null;
  try {
    let duel=startDuel(raw.seed,raw.mode as Duel['mode']);
    while(duel.picks.length<raw.picks.length){
      const id=raw.picks[duel.picks.length];
      if(typeof id!=='string'||!legalCards(duel).some(c=>c.id===id))return null;
      duel=draftCard(duel,id);
    }
    return JSON.stringify(duel.picks)===JSON.stringify(raw.picks)?duel:null;
  }catch{return null;}
}
