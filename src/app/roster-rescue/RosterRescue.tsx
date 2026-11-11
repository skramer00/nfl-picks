'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { lineup, TEAMS, type Card } from '@/lib/draftDuel';
import { RESCUE_STORAGE, makePuzzle, rescueDailySeed, restoreRescue, replaceCard, changes, solvePuzzle, total, type RescueSave } from '@/lib/rosterRescue';
import s from './rescue.module.css';
const fmt=(n:number)=>n.toFixed(2);
const pos=(p:string)=>p==='DST'?'D/ST':p;
export default function RosterRescue(){
  const [save,setSave]=useState<RescueSave|null>(null);
  const [history,setHistory]=useState<RescueSave[]>([]);
  const [ready,setReady]=useState(false);
  const [selected,setSelected]=useState<string|null>(null);
  const [notice,setNotice]=useState('');
  const [undo,setUndo]=useState<string[][]>([]);
  const [confirm,setConfirm]=useState<'daily'|'practice'|null>(null);
  const [share,setShare]=useState('');
  const benchHeading=useRef<HTMLHeadingElement>(null);
  const rosterHeading=useRef<HTMLHeadingElement>(null);
  const resultHeading=useRef<HTMLHeadingElement>(null);
  const seed=save?.seed;
  const puzzle=useMemo(()=>seed?makePuzzle(seed):null,[seed]);
  const cards=useMemo(()=>puzzle&&save?save.ids.map(id=>[...puzzle.starters,...puzzle.bench].find(c=>c.id===id)!):[],[puzzle,save]);
  const optimal=useMemo(()=>puzzle&&save?.submitted?solvePuzzle(puzzle):null,[puzzle,save?.submitted]);
  useEffect(()=>{let alive=true;Promise.resolve().then(()=>{
    try{const raw=JSON.parse(localStorage.getItem(RESCUE_STORAGE)||'null');const current=restoreRescue(raw?.active);const past=Array.isArray(raw?.completed)?raw.completed.slice(-40).map(restoreRescue).filter((v:ReturnType<typeof restoreRescue>)=>v?.save.submitted).map((v:NonNullable<ReturnType<typeof restoreRescue>>)=>v.save):[];
      if(alive){setSave(current?.save??null);setHistory(past);if(raw?.active&&!current)setNotice('That saved puzzle is no longer available. Start a new rescue.');}
    }catch{if(alive)setNotice('Saved progress could not be read. You can still play.');}if(alive)setReady(true);
  });return()=>{alive=false;};},[]);
  useEffect(()=>{if(save?.submitted)resultHeading.current?.focus();},[save?.submitted]);
  function persist(next:RescueSave,message:string){
    const completed=next.submitted?[...history.filter(x=>x.seed!==next.seed),next].slice(-40):history;
    setSave(next);setHistory(completed);setNotice(message);
    try{localStorage.setItem(RESCUE_STORAGE,JSON.stringify({active:next,completed}));}catch{setNotice(message+' Progress cannot be saved in this browser.');}
  }
  function begin(mode:'daily'|'practice'){
    const seed=mode==='daily'?rescueDailySeed(new Date()):'rescue-v1-practice-'+crypto.randomUUID();
    const previous=mode==='daily'?history.find(x=>x.seed===seed):null;
    const p=makePuzzle(seed);setSelected(null);setUndo([]);setConfirm(null);setShare('');
    persist(previous??{seed,mode,ids:p.starters.map(c=>c.id),submitted:false},previous?'Your completed daily rescue. Practice has unlimited new puzzles.':'Choose someone in your lineup to replace.');
  }
  function request(mode:'daily'|'practice'){
    if(save&&!save.submitted){if(mode==='daily'&&save.seed===rescueDailySeed(new Date())){setNotice('You are already playing today’s daily rescue.');return;}setConfirm(mode);}else begin(mode);
  }
  function swap(card:Card){
    if(!puzzle||!save||save.submitted||!selected)return;
    const next=replaceCard(puzzle,cards,selected,card.id);if(!next)return;
    const old=cards.find(c=>c.id===selected)!;
    setUndo([...undo,save.ids]);setSelected(null);persist({...save,ids:next.map(c=>c.id)},`${card.name} replaces ${old.name}. Lineup updated.`);rosterHeading.current?.focus();
  }
  const count=puzzle?changes(puzzle,cards):0;
  const baseline=puzzle?total(puzzle.starters):0;
  const gain=total(cards)-baseline;
  const bestGain=optimal?total(optimal)-baseline:0;
  const quality=optimal?(bestGain>0?Math.max(0,Math.min(100,Math.floor((Math.round(gain*100)/Math.round(bestGain*100))*100))):100):0;
  const available=puzzle?[...puzzle.bench,...puzzle.starters.filter(c=>!cards.some(x=>x.id===c.id))].filter(c=>!cards.some(x=>x.id===c.id)):[];
  const chosen=cards.find(c=>c.id===selected);
  return <main className={s.page}>
    <section className={s.hero}><div><p className={s.eyebrow}>PRETZEL QUEST / THE THREE-SWAP PUZZLE</p><h1>Roster <span>Rescue</span></h1><p className={s.lead}>Good team. Three great decisions away.</p><p>Take over a flawed fantasy roster. Find the upgrades, make up to three swaps, and squeeze out every point.</p><div className={s.actions}><button disabled={!ready} onClick={()=>request('daily')}>Daily rescue</button><button className={s.secondary} disabled={!ready} onClick={()=>request('practice')}>Practice rescue</button></div><p className={s.small}>No timer · No login · Best-season averages · {history.length} completed here</p></div><div className={s.badge} aria-hidden="true"><strong>3</strong><span>SWAPS TO SAVE<br/>YOUR SUNDAY</span></div></section>
    {confirm?<section className={s.panel} role="alertdialog" aria-labelledby="restart-title"><h2 id="restart-title">Start a different puzzle?</h2><p>Your unfinished lineup will be replaced. Completed results stay saved.</p><div className={s.actions}><button onClick={()=>begin(confirm)}>Start new rescue</button><button className={s.secondary} onClick={()=>setConfirm(null)}>Keep playing</button></div></section>:null}
    <p role="status" aria-live="polite" className={s.notice}>{notice||(!ready?'Loading saved progress…':'A little scouting goes a long way.')}</p>
    {puzzle&&save?<>
      <section className={s.score} aria-label="Rescue progress"><div><span>{save.mode==='daily'?'DAILY / '+save.seed.slice(-10):'PRACTICE'}</span><strong>{count} / 3</strong><span>swaps used</span></div><div><span>Starting score</span><strong>{fmt(baseline)}</strong><span>points per game</span></div><div><span>Your lineup</span><strong>{fmt(total(cards))}</strong><span>{gain>=0?'+':''}{fmt(gain)} improvement</span></div></section>
      {optimal?<section className={s.result}><p className={s.eyebrow}>RESCUE COMPLETE</p><h2 ref={resultHeading} tabIndex={-1}>{quality===100?'A perfect rescue.':quality>=85?'A strong turnaround.':quality>=60?'A solid upgrade.':'Room for a comeback.'}</h2><p>You gained <b>{fmt(gain)} points</b> out of a possible <b>{fmt(bestGain)}</b>. You captured <b>{quality}%</b> of the available improvement.</p><p>Best possible total: <b>{fmt(total(optimal))}</b> · Your gap: <b>{fmt(total(optimal)-total(cards))}</b></p><details><summary>See one best possible lineup</summary><ul className={s.solution}>{lineup(optimal).map(({slot,card},i)=><li key={i}><span>{pos(slot)}</span><b>{card!.name}</b><span>{card!.season} · {card!.team}</span><strong>{fmt(card!.average)}</strong></li>)}</ul></details><div className={s.actions}><button onClick={()=>request('practice')}>Play another rescue</button><button className={s.secondary} onClick={async()=>{const text=`Roster Rescue ${save.mode==='daily'?save.seed.slice(-10):'Practice'}\n${quality}% rescued · +${fmt(gain)} points · ${count}/3 swaps\nhttps://pretzel.quest/roster-rescue`;setShare(text);try{await navigator.clipboard.writeText(text);setNotice('Result copied.');}catch{setNotice('Copy your result from the box below.');}}}>Copy result</button></div>{share?<textarea aria-label="Shareable result" readOnly value={share} onFocus={e=>e.target.select()}/>:null}</section>:null}
      <div className={s.layout}>
        <section className={s.panel} aria-label="Your lineup"><p className={s.eyebrow}>01 / FIND THE WEAK LINK</p><h2 ref={rosterHeading} tabIndex={-1}>Your lineup</h2><p>{save.submitted?'Your final nine.':'Choose a player to see replacement options. FLEX adjusts automatically.'}</p><div className={s.lineup}>{lineup(cards).map(({slot,card},i)=>card?<button key={i} className={`${s.player} ${selected===card.id?s.selected:''}`} aria-pressed={selected===card.id} disabled={save.submitted} onClick={()=>{setSelected(card.id);benchHeading.current?.focus();}}><span className={s.slot}>{pos(slot)}</span><span><b>{card.name}</b><small>{card.season} · {card.team}{!puzzle.starters.some(x=>x.id===card.id)?' · NEW':''}</small></span><strong>{fmt(card.average)}</strong></button>:null)}</div>
        {!save.submitted?<><div className={s.actions}><button className={s.secondary} disabled={!undo.length} onClick={()=>{const ids=undo[undo.length-1];setUndo(undo.slice(0,-1));setSelected(null);persist({...save,ids},'Last swap undone.');}}>Undo</button><button className={s.secondary} disabled={count===0} onClick={()=>{setUndo([]);setSelected(null);persist({...save,ids:puzzle.starters.map(c=>c.id)},'Starting lineup restored.');}}>Reset lineup</button></div><button className={s.submit} onClick={()=>{setSelected(null);persist({...save,submitted:true},'Rescue submitted. Your result is locked.');}}>Lock in rescue · {count}/3 swaps</button><p className={s.small}>Experiment freely before locking in. Up to three different bench players can finish in your lineup. Locking reveals the answer and ends this attempt.</p></>:null}</section>
        <section className={s.panel} aria-label="Replacement pool"><p className={s.eyebrow}>02 / MAKE YOUR MOVES</p><h2 ref={benchHeading} tabIndex={-1}>{chosen?'Replace '+chosen.name:'The replacement pool'}</h2><p>{save.submitted?'The options you had to work with.':chosen?'Choose an eligible replacement below. Returning a starter refunds a swap.':'12 bench options. All scores are visible. Select a lineup player first.'}</p><div className={s.bench}>{available.map(card=>{const next=selected?replaceCard(puzzle,cards,selected,card.id):null;const delta=chosen?card.average-chosen.average:0;return <article key={card.id} className={s.card}><div className={s.cardTop}><span>{pos(card.position)}</span><span>{card.team} · {TEAMS[card.team]}</span></div><h3>{card.name}</h3><p>{card.season} best eligible season</p><strong className={s.points}>{fmt(card.average)} <small>PTS/GAME</small></strong><p className={s.small}>{fmt(card.points)} points ÷ {card.games} games</p>{!save.submitted?<button disabled={!next} aria-label={`Bring in ${card.name}`} onClick={()=>swap(card)}>{!chosen?'Select a starter':next?`Swap · ${delta>=0?'+':''}${fmt(delta)} pts`:count===3&&!puzzle.starters.some(c=>c.id===card.id)&&puzzle.starters.some(c=>c.id===selected)?'Three swaps used':'Doesn’t fit lineup'}</button>:null}</article>;})}</div></section>
      </div>
    </>:<section className={s.intro}><article><span>01</span><h2>Scout your nine.</h2><p>Your roster is complete, but there’s room to improve. Every score is visible.</p></article><article><span>02</span><h2>Find three upgrades.</h2><p>Compare 12 bench options. A big name isn’t always the biggest gain.</p></article><article><span>03</span><h2>See what you saved.</h2><p>Lock in your team to reveal the best possible rescue and your score.</p></article></section>}
    <details className={s.rules}><summary>Rules, scoring & daily puzzles</summary><p>Finish with 1 QB, 2 RB, 2 WR, 1 TE, 1 FLEX (RB/WR/TE), 1 kicker and 1 D/ST. Replace up to three starting players using the shared bench. No salary cap or franchise limit; no player can appear twice. Your replacement choices must keep a complete legal lineup.</p><p>Scores use the same curated best eligible 2000–2025 seasons and full-PPR scoring as <Link href="/draft-duel">Draft Duel</Link>, with at least eight games in the source stats. Individual return touchdowns count only for D/ST. Card values are rounded to two decimals and sum exactly. Missed games are not zeroes. See Draft Duel’s scoring rules for the complete breakdown.</p><p>The result measures your improvement against the exact best roster reachable in three swaps or fewer. Multiple optimal answers can exist. Daily puzzles reset at midnight Los Angeles time. Completed daily results are locked on this browser; practice is unlimited. Progress is saved only on this browser, and clearing storage resets it.</p><p>Historical data: <a href="https://github.com/nflverse/nflverse-data">nflverse</a> (CC BY 4.0), with schedules from <a href="https://github.com/nflverse/nfldata">nfldata</a>. The player exclusions used in Draft Duel also apply here.</p></details>
  </main>;
}
