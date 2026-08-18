import { createHmac, timingSafeEqual } from "node:crypto";

const encode = (value: string) => Buffer.from(value, "utf8").toString("base64url");
const decode = (value: string) => Buffer.from(value, "base64url").toString("utf8");

function signature(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createReminderUnsubscribeToken(userId: string, secret: string) {
  const payload = encode(userId);
  return `${payload}.${signature(payload, secret)}`;
}

export function verifyReminderUnsubscribeToken(token: string, secret: string) {
  const [payload, suppliedSignature, extra] = token.split(".");
  if (!payload || !suppliedSignature || extra) return null;

  const expectedSignature = signature(payload, secret);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;

  try {
    const userId = decode(payload);
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId) ? userId : null;
  } catch {
    return null;
  }
}

export function reminderUnsubscribeUrl(userId: string, secret: string) {
  const token = createReminderUnsubscribeToken(userId, secret);
  return `https://pretzel.quest/api/unsubscribe/reminders?token=${encodeURIComponent(token)}`;
}
