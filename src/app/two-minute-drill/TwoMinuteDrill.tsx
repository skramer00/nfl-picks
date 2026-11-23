"use client";

import { useState } from "react";
import { callPlay, callTimeout, dailyDriveKey, plays, startDrive, type Drive, type Play } from "@/lib/twoMinuteDrill";

const endings = {
  touchdown: "Touchdown! You win.",
  turnover: "Drive over on an interception",
  downs: "Turnover on downs",
  time: "Game over",
};

const dailyStorage = "pretzel-two-minute-drill-v1";

export default function TwoMinuteDrill() {
  const [drive, setDrive] = useState<Drive | null>(null);
  const [daily, setDaily] = useState(false);

  function begin(isDaily: boolean) {
    const key = isDaily ? dailyDriveKey() : crypto.randomUUID();
    let next = startDrive(key);
    if (isDaily) {
      try {
        const saved = JSON.parse(localStorage.getItem(dailyStorage) ?? "null") as Drive | null;
        if (saved?.key === key) next = saved;
      } catch {
        // The daily game is still playable when browser storage is unavailable.
      }
    }
    setDaily(isDaily);
    setDrive(next);
  }

  function update(next: Drive) {
    setDrive(next);
    if (daily) {
      try {
        localStorage.setItem(dailyStorage, JSON.stringify(next));
      } catch {
        // Keep the active drive available in memory.
      }
    }
  }

  const finished = drive && drive.outcome !== "playing";
  return (
    <main className="mx-auto max-w-3xl px-4 py-7 sm:px-6">
      <h1 className="text-4xl font-bold tracking-tight">Two-Minute Drill</h1>
      <p className="mt-3 text-lg text-gray-200">Down four with 90 seconds left. Drive 65 yards for the winning touchdown.</p>
      <p className="mt-2 text-gray-300">Take your time choosing. Only plays and time between snaps use the game clock.</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" disabled={Boolean(daily && drive)} onClick={() => begin(true)}
          className="min-h-11 rounded-lg bg-amber-400 px-4 font-bold text-gray-950 disabled:bg-amber-200">Daily drive</button>
        <button type="button" onClick={() => begin(false)}
          className="min-h-11 rounded-lg border border-gray-600 px-4 font-semibold hover:bg-gray-900">Practice drive</button>
      </div>
      {drive && (
        <section className="mt-6 rounded-2xl border border-gray-700 bg-gray-950 p-4 sm:p-6" aria-label="Drive">
          <p className="text-sm font-semibold text-amber-300">{daily ? `Daily drive · ${drive.key}` : "Practice drive"}</p>
          <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div><dt className="text-sm text-gray-300">Game clock</dt><dd className="text-2xl font-bold tabular-nums">{Math.floor(drive.seconds / 60)}:{String(drive.seconds % 60).padStart(2, "0")}</dd></div>
            <div><dt className="text-sm text-gray-300">Down & distance</dt><dd className="text-xl font-bold">{finished ? "—" : `${["", "1st", "2nd", "3rd", "4th"][drive.down]} & ${drive.firstDown === 65 ? "goal" : drive.firstDown - drive.yards}`}</dd></div>
            <div><dt className="text-sm text-gray-300">Yards to score</dt><dd className="text-xl font-bold">{65 - drive.yards}</dd></div>
            <div><dt className="text-sm text-gray-300">Timeouts</dt><dd className="text-xl font-bold">{drive.timeouts}</dd></div>
          </dl>
          <progress aria-label="Yards gained on the drive" className="mt-4 h-3 w-full accent-amber-400" value={drive.yards} max={65} />
          <div role="status" className="my-4 text-gray-200">
            {drive.outcome !== "playing" && <h2 className="mb-1 text-xl font-bold text-amber-300">{endings[drive.outcome]}</h2>}
            <p>{drive.message}</p>
            {drive.clockRunning && <p className="mt-1 text-amber-200">Running clock. The next snap uses 12 extra seconds unless you call timeout.</p>}
          </div>
          {!finished && (
            <>
              <h2 className="mb-2 text-lg font-semibold">Call a play</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {(Object.entries(plays) as [Play, (typeof plays)[Play]][]).map(([play, option]) => (
                  <button key={play} type="button" onClick={() => update(callPlay(drive, play))}
                    className="rounded-lg border border-gray-600 p-3 text-left hover:border-amber-400 focus-visible:outline-2 focus-visible:outline-amber-300">
                    <span className="block font-semibold">{option.name}</span>
                    <span className="block text-sm text-gray-300">{option.description}</span>
                  </button>
                ))}
              </div>
              <button type="button" disabled={!drive.clockRunning || !drive.timeouts} onClick={() => update(callTimeout(drive))}
                className="mt-3 min-h-11 rounded-lg border border-gray-600 px-4 font-semibold enabled:hover:bg-gray-800 disabled:text-gray-500">Call timeout</button>
            </>
          )}
        </section>
      )}
      <p className="mt-5 text-sm text-gray-400">The daily drive resets at midnight Pacific time. Practice generates a fresh drive.</p>
    </main>
  );
}
