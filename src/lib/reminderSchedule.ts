export type LocalDay = { year: number; month: number; day: number; weekday: string };

export function localDay(date: Date, timeZone: string): LocalDay {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return { year: Number(value("year")), month: Number(value("month")), day: Number(value("day")), weekday: value("weekday") };
}

export function localDateKey(date: Date, timeZone: string) { const value = localDay(date, timeZone); return `${value.year}-${String(value.month).padStart(2, "0")}-${String(value.day).padStart(2, "0")}`; }

export function utcForLocal(day: LocalDay, hour: number, timeZone: string) {
  const desired = Date.UTC(day.year, day.month - 1, day.day, hour, 0, 0);
  let guess = desired;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const rendered = new Intl.DateTimeFormat("en-US", { timeZone, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(guess));
    const number = (type: Intl.DateTimeFormatPartTypes) => Number(rendered.find((part) => part.type === type)?.value ?? 0);
    const shown = Date.UTC(number("year"), number("month") - 1, number("day"), number("hour") % 24, number("minute"));
    guess += desired - shown;
  }
  return new Date(guess);
}

export function reminderKindForDay(day: LocalDay) { return day.weekday === "Thu" ? "thursday" : day.weekday === "Sun" ? "sunday" : null; }
