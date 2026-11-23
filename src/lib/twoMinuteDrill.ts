import { localDateKey } from "./reminderSchedule";

export const plays = {
  run: { name: "Run up the middle", description: "2–9 yards · 5 seconds · Clock runs", yards: [2, 4, 5, 9], seconds: 5 },
  sideline: { name: "Sideline pass", description: "5–16 yards on a catch · 6 seconds · Stops clock", yards: [0, 5, 9, 16], seconds: 6 },
  middle: { name: "Pass over the middle", description: "10–24 yards on a catch · 7 seconds · Clock runs on a catch", yards: [0, 10, 16, 24], seconds: 7 },
  deep: { name: "Deep pass", description: "25–40 yards on a catch · 9 seconds · 25% interception risk · Clock runs on a catch", yards: [-1, 0, 25, 40], seconds: 9 },
} as const;

export type Play = keyof typeof plays;
type Outcome = "touchdown" | "turnover" | "time" | "downs" | "playing";
export type Drive = {
  key: string;
  yards: number;
  firstDown: number;
  down: number;
  seconds: number;
  timeouts: number;
  clockRunning: boolean;
  snaps: number;
  outcome: Outcome;
  message: string;
};

export function dailyDriveKey() {
  return localDateKey(new Date(), "America/Los_Angeles");
}

export function startDrive(key: string): Drive {
  return { key, yards: 0, firstDown: 10, down: 1, seconds: 90, timeouts: 2, clockRunning: false, snaps: 0, outcome: "playing", message: "You have the ball at your own 35. A touchdown wins." };
}

function roll(drive: Drive, play: Play) {
  let hash = 2166136261;
  for (const character of `${drive.key}/${drive.snaps}/${play}`) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  }
  return (hash >>> 0) >>> 30;
}

export function callPlay(drive: Drive, play: Play): Drive {
  if (drive.outcome !== "playing") return drive;
  const beforeSnap = drive.seconds - (drive.clockRunning ? 12 : 0);
  if (beforeSnap <= 0) return { ...drive, seconds: 0, outcome: "time", message: "The clock ran out before the snap." };

  const playInfo = plays[play];
  const gain = playInfo.yards[roll(drive, play)];
  const seconds = Math.max(0, beforeSnap - playInfo.seconds);
  const yards = Math.min(65, drive.yards + Math.max(0, gain));
  const firstDown = yards >= drive.firstDown;
  const down = firstDown ? 1 : drive.down + 1;
  const outcome = gain < 0 ? "turnover" : yards === 65 ? "touchdown" : down > 4 ? "downs" : seconds === 0 ? "time" : "playing";
  const clockRunning = outcome === "playing" && gain > 0 && play !== "sideline";
  let message = gain < 0 ? "Intercepted. The defense takes over." : gain === 0 ? "Incomplete pass." : `Gain of ${yards - drive.yards} yards.`;
  if (outcome === "playing" && firstDown) message += " First down.";
  return { ...drive, yards, seconds, down, firstDown: firstDown ? Math.min(65, yards + 10) : drive.firstDown,
    clockRunning, snaps: drive.snaps + 1, outcome, message };
}

export function callTimeout(drive: Drive): Drive {
  if (drive.outcome !== "playing" || !drive.clockRunning || !drive.timeouts) return drive;
  return { ...drive, clockRunning: false, timeouts: drive.timeouts - 1, message: "Timeout. The clock is stopped." };
}
