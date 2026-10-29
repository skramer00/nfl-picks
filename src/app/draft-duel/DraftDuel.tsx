'use client';

import { useEffect, useState, useTransition } from 'react';
import { CARDS, TEAMS, POSITIONS, STORAGE_KEY, dailySeed, startDuel, draftCard, roster, score, lineup, legalCards, restoreDuel, sideAt, type Duel, type Position, type Card } from '@/lib/draftDuel';
import styles from './duel.module.css';

type Saved = { seed:string; mode:Duel['mode']; picks:string[] };
type Archive = { active:Saved|null; completed:Saved[] };
const saved=(game:Duel):Saved=>({seed:game.seed,mode:game.mode,picks:game.picks});
const positionLabel=(p:string)=>p==='DST'?'D/ST':p;
const number=(n:number)=>n.toFixed(2);

function Roster({game,side}:{game:Duel;side:'you'|'cpu'}) {
  const cards=roster(game,side);
  return <section className={styles.roster} aria-label={side==='you'?'Your roster':'Computer roster'}>
    <div className={styles.rosterHead}><div><span className={styles.eyebrow}>{side==='you'?'YOUR SIDELINE':'THE OPPOSITION'}</span><h2>{side==='you'?'Your legends':'The computer'}</h2></div><strong>{number(score(cards))}<small>points</small></strong></div>
    <p className={styles.muted}>{cards.length} of 9 roster spots filled</p>
    <ol className={styles.lineup}>{lineup(cards).map(({slot,card},i)=><li key={slot+i}>
      <span className={styles.slot}>{positionLabel(slot)}</span><div>{card?<><b>{card.name}</b><small>{card.season} · {card.team}</small></>:<span className={styles.empty}>Open spot</span>}</div><strong>{card?number(card.average):'—'}</strong>
    </li>)}</ol>
  </section>;
}
function Rules(){return <details className={styles.rules}>
  <summary>How to play & scoring</summary>
  <div className={styles.ruleGrid}>
    <div><h3>Build your dream lineup</h3><p>Draft 1 QB, 2 RBs, 2 WRs, 1 TE, 1 flex (RB/WR/TE), 1 kicker and 1 defense. The computer competes for the same cards. Snake order alternates who picks first each round, so you sometimes get two picks together.</p><p>Every pool has exactly one card per franchise: 4 QBs, 8 RBs, 10 WRs, 4 TEs, 3 kickers and 3 defenses. All 32 cards are visible. No duplicates, timer, injuries or random matchup rolls.</p><h3>Always their best eligible season</h3><p>Each player uses their highest points per game from the 2000–2025 regular seasons, with at least 8 games in the source stats. Missed games aren’t zeroes; partial games still count. These are raw fantasy averages, without an era adjustment.</p><p>Franchises include their earlier cities and names. A traded player’s full-season stats are credited to the source’s most recent team. Each defense uses its franchise’s best season in the same window.</p></div>
    <div><h3>Offense · full PPR</h3><p>1 point per reception; 1 per 10 rushing/receiving yards; 1 per 25 passing yards. Rushing/receiving TD: 6. Passing TD: 4. Interception thrown or offensive fumble lost: −2. Two-point conversion: 2. Return TDs count only for D/ST.</p><h3>Kickers</h3><p>Made extra point: 1. Made field goals: 3 points under 40 yards, 4 from 40–49, 5 from 50+. No missed-kick penalties.</p><h3>Defense / special teams</h3><p>Sack: 1. Interception, opponent fumble recovery or safety: 2. Defensive or special-teams TD: 6. Weekly opponent final-score bonus: 0 points allowed = +10; 1–6 = +7; 7–13 = +4; 14–20 = +1; 21–27 = 0; 28–34 = −1; 35+ = −4. This uses the opponent’s whole final score, including scores against the offense. No yardage or blocked-kick bonuses.</p><p>Card averages round to two decimals. Those displayed values add up to your score. Equal totals are a tie.</p></div>
  </div>
  <p className={styles.muted}>Historical statistics: <a href="https://github.com/nflverse/nflverse-data" target="_blank" rel="noreferrer">nflverse</a>, CC BY 4.0; schedules: <a href="https://github.com/nflverse/nfldata" target="_blank" rel="noreferrer">nflverse / nfldata</a>. {CARDS.length.toLocaleString('en-US')} cards in the catalog. Daily pools reset at midnight Los Angeles time. Progress and completed drafts save on this browser; no account required.</p>
</details>;}

export default function DraftDuel(){
  const [game,setGame]=useState<Duel|null>(null);
  const [archive,setArchive]=useState<Archive>({active:null,completed:[]});
  const [ready,setReady]=useState(false);
  const [filter,setFilter]=useState<Position|'ALL'>('ALL');
  const [search,setSearch]=useState('');
  const [showDrafted,setShowDrafted]=useState(false);
  const [notice,setNotice]=useState('');
  const [pendingMode,setPendingMode]=useState<Duel['mode']|null>(null);
  const [busy,startTransition]=useTransition();
  useEffect(()=>{
    let active=true;
    Promise.resolve().then(()=>{
      if(!active)return;
      try{
        const text=localStorage.getItem(STORAGE_KEY);
        const raw=text?JSON.parse(text):null;
        if(!text&&localStorage.getItem('pretzel-draft-duel-v1'))setNotice('The player pool and computer strategy have been updated. Start a fresh draft; older drafts are no longer loaded.');
        const restored=restoreDuel(raw?.active);
        const completed=Array.isArray(raw?.completed)?raw.completed.filter((v:Saved)=>v&&typeof v.seed==='string'&&Array.isArray(v.picks)&&v.picks.length===18).slice(-60):[];
        setArchive({active:restored?saved(restored):null,completed});setGame(restored);
      }catch{setNotice('Saved progress could not be loaded. You can still start a new draft.');}
      setReady(true);
    });
    return()=>{active=false;};
  },[]);
  function commit(next:Duel,message:string){
    const completed=next.picks.length===18?[...archive.completed.filter(g=>g.seed!==next.seed),saved(next)].slice(-60):archive.completed;
    const updated={active:saved(next),completed};
    setArchive(updated);setGame(next);setNotice(message);
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(updated));}catch{setNotice(message+' Browser storage is unavailable; this draft will not survive a reload.');}
  }
  function begin(mode:Duel['mode']){
    setPendingMode(null);setFilter('ALL');setSearch('');setShowDrafted(false);
    startTransition(()=>{
      try{
        const seed=mode==='daily'?dailySeed(new Date()):'practice-v2-'+crypto.randomUUID();
        const previous=mode==='daily'?archive.completed.find(g=>g.seed===seed):null;
        const next=(previous&&restoreDuel(previous))||startDuel(seed,mode);
        commit(next,previous?'Your completed daily draft. Try unlimited practice for another matchup.':next.first==='you'?'You have the first pick.':'The computer picked first. You have the next two picks.');
      }catch{setNotice('The draft could not be created. Please try again.');}
    });
  }
  function requestStart(mode:Duel['mode']){
    if(game&&game.picks.length<18){setPendingMode(mode);return;}begin(mode);
  }
  function pick(card:Card){
    if(!game||busy)return;
    startTransition(()=>{
      const next=draftCard(game,card.id);
      if(next===game)return;
      const cpu=next.picks.slice(game.picks.length+1).map(id=>next.pool.find(c=>c.id===id)!.name);
      commit(next,`You drafted ${card.name}.${cpu.length?' Computer drafted '+cpu.join(' and ')+'.':''}${next.picks.length===18?' Draft complete.': ' Your pick.'}`);
    });
  }
  const finished=game?.picks.length===18;
  const legal=game?new Set(legalCards(game).map(c=>c.id)):new Set<string>();
  const yourScore=game?score(roster(game,'you')):0;
  const cpuScore=game?score(roster(game,'cpu')):0;
  const displayed=game?.pool.filter(c=>(showDrafted||!game.picks.includes(c.id))&&(filter==='ALL'||c.position===filter)&&`${c.name} ${c.team} ${TEAMS[c.team]} ${c.season}`.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>b.average-a.average||a.name.localeCompare(b.name))??[];
  const title=finished?(yourScore===cpuScore?'A dead heat.':yourScore>cpuScore?'Your legends win.':'The computer takes it.'):'Build a roster. Settle the score.';
  return <main className={styles.page}>
    <section className={styles.hero}>
      <div className={styles.heroCopy}><p className={styles.eyebrow}>PRETZEL QUEST · PLAY ANYTIME</p><h1>Draft <em>Duel</em><span className={styles.beta}>BETA</span></h1><p className={styles.tagline}>{title}</p><p className={styles.intro}>32 franchises. Nine picks. Every player at their best.<br/>Take on the computer in a draft across football eras.</p>
      <div className={styles.actions}><button className={styles.primary} disabled={!ready||busy} onClick={()=>requestStart('practice')}>{game?'New practice draft':'Start a draft'} <span aria-hidden="true">↗</span></button><button className={styles.secondary} disabled={!ready||busy} onClick={()=>requestStart('daily')}>Daily challenge</button></div>
      <p className={styles.muted}>{!ready?'Loading your draft…':`No login needed · No timer · ${archive.completed.length} completed draft${archive.completed.length===1?'':'s'} saved here`}</p></div>
      <div className={styles.heroArt} aria-hidden="true"><div className={styles.field}><span>THE DRAFT ROOM</span><b>32</b><span>FRANCHISES</span><div className={styles.fieldLine}/><strong>YOU <i>vs</i> CPU</strong></div></div>
    </section>
    {pendingMode?<section className={styles.confirm} role="alertdialog" aria-labelledby="replace-title" aria-describedby="replace-description"><h2 id="replace-title">Start a different draft?</h2><p id="replace-description">This replaces your unfinished roster. Completed drafts stay saved on this browser.</p><button className={styles.primary} onClick={()=>begin(pendingMode)}>Start new draft</button> <button className={styles.secondary} onClick={()=>setPendingMode(null)}>Keep drafting</button></section>:null}
    <p className={styles.notice} role="status" aria-live="polite">{notice}</p>
    {game?<>
      <section className={styles.scoreboard} aria-label="Matchup score"><div><span>{game.mode==='daily'?'DAILY · '+game.seed.slice(-10):'PRACTICE DRAFT'}</span><h2>{finished?'Final score':`Pick ${game.picks.length+1} of 18 · Your turn`}</h2><p>{finished?'Sum of each roster’s season averages.':`Snake draft · ${game.first==='you'?'You pick':'Computer picks'} first · Plan for the next turn.`}</p></div><div className={styles.scorePair}><strong>{number(yourScore)}<small>YOU</small></strong><span>:</span><strong>{number(cpuScore)}<small>COMPUTER</small></strong></div></section>
      {finished?<section className={styles.result}><h2>{title}</h2><p>{yourScore===cpuScore?'Both rosters finished with the same total.':`${yourScore>cpuScore?'You won':'You lost'} by ${number(Math.abs(yourScore-cpuScore))} points.`} Compare the lineups below, or draft a new set of legends.</p><button className={styles.primary} onClick={()=>begin('practice')}>Play another draft</button></section>:null}
      <div className={styles.rosters}><Roster game={game} side="you"/><Roster game={game} side="cpu"/></div>
      <section className={styles.board} aria-label="Draft board"><div className={styles.boardHeading}><div><p className={styles.eyebrow}>ONE CARD. EVERY FRANCHISE.</p><h2>{finished?'The draft board':'On the clock'}</h2></div><span className={styles.poolCount}>{32-game.picks.length} available / 32</span></div>
        <div className={styles.toolbar}><label className={styles.search}><span>Find a player or team</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name, franchise or season" type="search"/></label><label className={styles.check}><input type="checkbox" checked={showDrafted} onChange={e=>setShowDrafted(e.target.checked)}/> Show drafted cards</label></div>
        <div className={styles.filters} role="group" aria-label="Filter by position">{(['ALL',...POSITIONS] as const).map(p=><button key={p} aria-pressed={filter===p} onClick={()=>setFilter(p)}>{positionLabel(p)} <span>{game.pool.filter(c=>(p==='ALL'||c.position===p)&&!game.picks.includes(c.id)).length}</span></button>)}</div>
        <p className={styles.muted}>Highest average first · Flex fills automatically · Card values are points per game</p>
        <div className={styles.cards}>{displayed.map(card=>{
          const index=game.picks.indexOf(card.id);const drafted=index>=0;const allowed=legal.has(card.id);
          return <article key={card.id} className={`${styles.card} ${drafted?styles.drafted:''}`}>
            <div className={styles.cardTop}><span className={styles.position}>{positionLabel(card.position)}</span><span>{card.team} · {TEAMS[card.team]}</span></div>
            <h3>{card.name}</h3><p className={styles.season}>{card.season} <span>BEST ELIGIBLE SEASON</span></p>
            <div className={styles.cardScore}><strong>{number(card.average)}</strong><span>PTS / GAME</span></div>
            <p className={styles.cardMeta}>{number(card.points)} points ÷ {card.games} games</p>
            <button disabled={busy||!allowed||finished} aria-label={`${drafted?'Drafted': 'Draft'} ${card.name}, ${card.season}, ${card.team}, ${positionLabel(card.position)}, ${number(card.average)} points per game`} onClick={()=>pick(card)}>{drafted?`Picked by ${sideAt(index,game.first)==='you'?'you':'computer'}`:finished?'Undrafted':!allowed?'Position filled':busy?'Drafting…':'Draft player'}{allowed&&!busy?<span aria-hidden="true"> +</span>:null}</button>
          </article>;
        })}</div>
        {!displayed.length?<p className={styles.noResults}>No matching cards. Try another position, clear your search, or show drafted cards.</p>:null}
      </section>
      <details className={styles.rules}><summary>Draft history · {game.picks.length} picks</summary><ol className={styles.history}>{game.picks.map((id,i)=>{const card=game.pool.find(c=>c.id===id)!;return <li key={id}><span>#{i+1} · {sideAt(i,game.first)==='you'?'You':'Computer'}</span><b>{card.name}</b><span>{card.season} · {card.team} · {positionLabel(card.position)} · {number(card.average)}</span></li>;})}</ol></details>
    </>:<section className={styles.welcome}><div><span>01 / SCOUT</span><h2>Know the board.</h2><p>See all 32 cards and their scores. Some franchises bring legends. Others bring a tough decision.</p></div><div><span>02 / DRAFT</span><h2>Pick your moment.</h2><p>Grab a star or fill a scarce position. Your opponent can take the player you’re saving for later.</p></div><div><span>03 / DUEL</span><h2>Let the numbers talk.</h2><p>Nine season averages. One team total. The better roster wins—with every point explained.</p></div></section>}
    <Rules/>
  </main>;
}
