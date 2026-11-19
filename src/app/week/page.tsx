import { redirect } from "next/navigation";
import { connection } from "next/server";

import { localDateKey } from "@/lib/reminderSchedule";
import { ALL_GAMES } from "@/lib/season";

const timeZone = "America/New_York";
const lastGameDayByWeek = new Map<number, string>();

for (const game of ALL_GAMES) {
  const gameDay = localDateKey(new Date(game.kickoffISO), timeZone);
  const lastGameDay = lastGameDayByWeek.get(game.week);
  if (!lastGameDay || gameDay > lastGameDay) {
    lastGameDayByWeek.set(game.week, gameDay);
  }
}

const scheduledWeeks = [...lastGameDayByWeek].sort(([weekA], [weekB]) => weekA - weekB);

export default async function WeekIndex() {
  await connection();

  const today = localDateKey(new Date(), timeZone);
  const currentWeek = scheduledWeeks.find(([, lastGameDay]) => lastGameDay >= today);
  const week = currentWeek?.[0] ?? scheduledWeeks.at(-1)?.[0] ?? 1;

  redirect(`/week/${week}`);
}
