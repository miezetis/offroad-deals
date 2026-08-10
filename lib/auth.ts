import { createHash, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "offroad_session";

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

function equal(a: Buffer, b: Buffer) {
  return a.length === b.length && timingSafeEqual(a, b);
}

export function sessionToken() {
  const password = process.env.SITE_PASSWORD;
  if (!password) throw new Error("SITE_PASSWORD is not set");
  return digest(`offroad-session:${password}`).toString("hex");
}

export function isValidSession(token: string | undefined) {
  if (!token) return false;
  return equal(Buffer.from(token), Buffer.from(sessionToken()));
}

export function passwordMatches(input: string) {
  const password = process.env.SITE_PASSWORD;
  if (!password) throw new Error("SITE_PASSWORD is not set");
  return equal(digest(input), digest(password));
}
