export type PickMap = Record<string, string>; // gameId -> teamAbbr

const STORAGE_KEY = "nfl-picks:2026";

export function loadPicks(): PickMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PickMap) : {};
  } catch {
    return {};
  }
}

export function savePicks(picks: PickMap) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(picks));
}

export function setPick(gameId: string, teamAbbr: string) {
  const picks = loadPicks();
  picks[gameId] = teamAbbr;
  savePicks(picks);
  return picks;
}