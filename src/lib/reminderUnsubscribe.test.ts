import assert from "node:assert/strict";
import test from "node:test";
import { createReminderUnsubscribeToken, verifyReminderUnsubscribeToken } from "./reminderUnsubscribe";

const USER_ID = "123e4567-e89b-42d3-a456-426614174000";

test("reminder unsubscribe tokens round trip", () => {
  const token = createReminderUnsubscribeToken(USER_ID, "test-secret");
  assert.equal(verifyReminderUnsubscribeToken(token, "test-secret"), USER_ID);
});

test("reminder unsubscribe tokens reject tampering and the wrong secret", () => {
  const token = createReminderUnsubscribeToken(USER_ID, "test-secret");
  assert.equal(verifyReminderUnsubscribeToken(`${token}x`, "test-secret"), null);
  assert.equal(verifyReminderUnsubscribeToken(token, "different-secret"), null);
});
