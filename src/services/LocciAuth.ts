import { createHash } from "node:crypto";
import { createClient } from "@openauthjs/openauth/client";
import { createSubjects } from "@openauthjs/openauth/subject";
import * as v from "valibot";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

/**
 * Locci Auth: the OpenAuth issuer locci-platform signs in with, and the issuer
 * of Locci API keys. This service holds no credentials of its own for these:
 *
 *   - an access token (the web console's sign-in) is checked against the
 *     issuer's keys, fetched once and then cached by OpenAuth;
 *   - an API key (`locci_sk_live_...`, created in the console or locci-platform)
 *     is traded for an access token at the issuer's /keys/token, as
 *     locci-registry does, and that token is checked the same way.
 *
 * So revoking a key at Locci Auth revokes it here, within a token's lifetime.
 */

export const LOCCI_KEY_PREFIX = "locci_sk_live_";

export interface LocciUser {
  id: string;
  email: string;
}

/** The subject locci-auth issues, as locci-platform declares it. */
const subjects = createSubjects({
  user: v.object({ id: v.string(), email: v.string() }),
});

let client: ReturnType<typeof createClient> | null = null;

export const locciAuthEnabled = () => Boolean(env.LOCCI_AUTH_ISSUER);

/** The signed-in Locci user, or null for a token that is not a valid Locci Auth one. */
export async function verifyLocciToken(token: string): Promise<LocciUser | null> {
  if (!env.LOCCI_AUTH_ISSUER) return null;
  // The client id only matters for authorize and exchange, which the console does.
  client ??= createClient({ clientID: "locci-box-api", issuer: env.LOCCI_AUTH_ISSUER });
  try {
    const verified = await client.verify(subjects, token);
    if (verified.err || verified.subject.type !== "user") return null;
    return verified.subject.properties;
  } catch (error) {
    logger.warn({ error: String(error) }, "Locci Auth verification failed");
    return null;
  }
}

/** Tokens traded for keys, by the key's hash, until a minute before they expire. */
const exchanged = new Map<string, { token: string; until: number }>();

/** An access token for a Locci API key, or null when Locci Auth rejects the key. */
export async function exchangeLocciKey(key: string): Promise<string | null> {
  if (!env.LOCCI_AUTH_ISSUER) return null;
  const id = createHash("sha256").update(key).digest("hex");
  const cached = exchanged.get(id);
  if (cached && cached.until > Date.now()) return cached.token;
  exchanged.delete(id);

  const res = await fetch(`${env.LOCCI_AUTH_ISSUER}/keys/token`, {
    method: "POST",
    headers: { "x-locci-api-key": key },
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`Locci Auth answered ${res.status} to a key exchange`);
  const body = (await res.json()) as { token?: string; access_token?: string; expiresIn?: number };
  const token = body.token ?? body.access_token;
  if (!token) return null;
  const ttl = Math.max(0, (body.expiresIn ?? 300) - 60) * 1000;
  exchanged.set(id, { token, until: Date.now() + ttl });
  return token;
}

/**
 * Manage the caller's Locci API keys at the issuer (`/keys`), with their own
 * access token. Through this API because Locci Auth sends no CORS headers, so
 * the console cannot call it from the browser.
 */
export async function locciKeysRequest(accessToken: string, path: string, init: RequestInit = {}): Promise<Response> {
  if (!env.LOCCI_AUTH_ISSUER) throw new Error("LOCCI_AUTH_ISSUER is not set");
  return fetch(`${env.LOCCI_AUTH_ISSUER}/keys${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}`, ...init.headers },
  });
}
