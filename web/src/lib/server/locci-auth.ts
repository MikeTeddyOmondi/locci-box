import { createClient } from '@openauthjs/openauth/client';
import { createSubjects } from '@openauthjs/openauth/subject';
import { object, string } from 'valibot';
import { env as publicEnv } from '$env/dynamic/public';
import { env } from '$env/dynamic/private';

/**
 * Locci Auth, the OpenAuth issuer locci-platform signs in with, and the issuer
 * of Locci API keys. Set with locci-platform's names: PUBLIC_OPENAUTH_ISSUER and
 * PUBLIC_OPENAUTH_CLIENT_ID.
 *
 * As in locci-storage's API, `issuer` has two jobs that differ in a container:
 * it is the `iss` every token must carry, and the address its keys are fetched
 * from. LOCCI_AUTH_INTERNAL_ORIGIN, when set, redirects only the fetches.
 */

export const subjects = createSubjects({
	user: object({ id: string(), email: string() })
});

export const LOCCI_KEY_PREFIX = 'locci_sk_live_';

export const issuer = () => publicEnv.PUBLIC_OPENAUTH_ISSUER || 'http://localhost:8787';
const clientID = () => publicEnv.PUBLIC_OPENAUTH_CLIENT_ID || 'locci-box';

/** Where requests to the issuer go: LOCCI_AUTH_INTERNAL_ORIGIN when set. */
function reachable(url: string): string {
	const internal = env.LOCCI_AUTH_INTERNAL_ORIGIN;
	return internal && url.startsWith(issuer()) ? internal + url.slice(issuer().length) : url;
}

const internalFetch: typeof fetch = (input, init) =>
	fetch(reachable(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url), init);

let client: ReturnType<typeof createClient> | null = null;
export function authClient() {
	client ??= createClient({ clientID: clientID(), issuer: issuer(), fetch: internalFetch });
	return client;
}

/** Verification failed because the issuer could not be reached, not because the credential is bad. */
export class AuthUnavailableError extends Error {
	constructor(cause: unknown) {
		super('Could not reach Locci Auth');
		this.name = 'AuthUnavailableError';
		this.cause = cause;
	}
}

/**
 * Verify an access token (refreshing it when a refresh token is given),
 * separating "this token is bad" (`{err}`) from "we could not check" (throws
 * AuthUnavailableError). OpenAuth's verify throws when the issuer's keys cannot
 * be fetched; left alone that would read as a bad token, and the caller would
 * be sent to sign in again for an outage.
 */
export async function verifyAccessToken(token: string, refresh?: string) {
	try {
		return await authClient().verify(subjects, token, refresh ? { refresh } : undefined);
	} catch (cause) {
		throw new AuthUnavailableError(cause);
	}
}

/** Trade a Locci API key for an access token at the issuer, as locci-registry does; null when rejected. */
export async function exchangeApiKey(key: string): Promise<string | null> {
	let res: Response;
	try {
		res = await fetch(reachable(`${issuer()}/keys/token`), { method: 'POST', headers: { 'x-locci-api-key': key } });
	} catch (cause) {
		throw new AuthUnavailableError(cause);
	}
	if (res.status === 401) return null;
	if (!res.ok) throw new AuthUnavailableError(new Error(`Locci Auth answered ${res.status}`));
	const body = (await res.json()) as { token?: string; access_token?: string };
	return body.token ?? body.access_token ?? null;
}
