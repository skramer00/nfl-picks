import { createHash } from "node:crypto";

export type GameDayAlertType = "sync_error" | "stale_sync" | "result_attention" | "test_alert";

function bucket(now: Date, hours: number) {
  const bucketNumber = Math.floor(now.getTime() / (hours * 60 * 60 * 1000));
  return String(bucketNumber);
}

export function gameDayIncidentKey({
  type,
  season,
  subjects,
  now,
}: {
  type: GameDayAlertType;
  season: number;
  subjects: string[];
  now: Date;
}) {
  const windowHours = type === "sync_error" ? 6 : 24;
  const subjectHash = createHash("sha256").update([...subjects].sort().join(":"), "utf8").digest("hex").slice(0, 20);
  return [season, type, bucket(now, windowHours), subjectHash].join(":");
}

export function gameDayTestIncidentKey(season: number, requestId: string) {
  return [season, "test_alert", requestId].join(":");
}
