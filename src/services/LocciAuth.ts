import { createHash } from "node:crypto";
import { createClient } from "@openauthjs/openauth/client";
import { createSubjects } from "@openauthjs/openauth/subject";
import * as v from "valibot";
import { env } from "../config/env.js";

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

/** Verification failed because the issuer could not be reached, not because the token is bad. */
export class AuthUnavailableError extends Error {
  constructor(cause: unknown) {
    super("Could not reach Locci Auth to verify the token");
    this.name = "AuthUnavailableError";
    this.cause = cause;
  }
}

/** The issuer's URL, with requests sent to LOCCI_AUTH_INTERNAL_ORIGIN when set. */
function issuerUrl(path: string): string {
  return `${env.LOCCI_AUTH_INTERNAL_ORIGIN ?? env.LOCCI_AUTH_ISSUER}${path}`;
}

/**
 * `issuer` is both the expected `iss` claim and where the keys are fetched
 * from; in a container those differ, so only the fetches are redirected.
 */
const internalFetch: typeof fetch = (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const issuer = env.LOCCI_AUTH_ISSUER!;
  if (env.LOCCI_AUTH_INTERNAL_ORIGIN && url.startsWith(issuer)) {
    return fetch(env.LOCCI_AUTH_INTERNAL_ORIGIN + url.slice(issuer.length), init);
  }
  return fetch(input, init);
};

/**
 * The signed-in Locci user, or null for a token that is not a valid Locci Auth
 * one. Throws AuthUnavailableError when the issuer's keys cannot be fetched: the
 * token may be fine, so that is a 503, not a 401 (OpenAuth's verify throws
 * there rather than returning an error). Once fetched, the keys are kept.
 */
export async function verifyLocciToken(token: string): Promise<LocciUser | null> {
  if (!env.LOCCI_AUTH_ISSUER) return null;
  // The client id only matters for authorize and exchange, which the console does.
  client ??= createClient({ clientID: "locci-box-api", issuer: env.LOCCI_AUTH_ISSUER, fetch: internalFetch });
  let verified;
  try {
    verified = await client.verify(subjects, token);
  } catch (error) {
    throw new AuthUnavailableError(error);
  }
  if (verified.err || verified.subject.type !== "user") return null;
  return verified.subject.properties;
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

  let res: Response;
  try {
    res = await fetch(issuerUrl("/keys/token"), { method: "POST", headers: { "x-locci-api-key": key } });
  } catch (error) {
    throw new AuthUnavailableError(error);
  }
  if (res.status === 401) return null;
  if (!res.ok) throw new AuthUnavailableError(new Error(`Locci Auth answered ${res.status} to a key exchange`));
  const body = (await res.json()) as { token?: string; access_token?: string; expiresIn?: number };
  const token = body.token ?? body.access_token;
  if (!token) return null;
  const ttl = Math.max(0, (body.expiresIn ?? 300) - 60) * 1000;
  exchanged.set(id, { token, until: Date.now() + ttl });
  return token;
}
