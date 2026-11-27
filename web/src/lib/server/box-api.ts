import { error } from '@sveltejs/kit';
import { getRequestEvent } from '$app/server';
import { env } from '$env/dynamic/private';

/**
 * The Locci Box API, called from this server with the signed-in user's Locci
 * Auth access token (the API verifies it against the same issuer). The browser
 * never holds the token. LOCCI_BOX_API_URL is where this server reaches the API
 * (http://api:5757 in compose).
 */

export const boxApiUrl = () => env.LOCCI_BOX_API_URL || 'http://localhost:5757';

/** The caller's access token, or a 401 for a signed-out request (as locci-platform's requireAuth). */
export function requireAuth() {
	const { locals } = getRequestEvent();
	if (!locals.user || !locals.accessToken) error(401, 'Sign in to continue');
	return { user: locals.user, accessToken: locals.accessToken };
}

/** Call the API as the signed-in user and unwrap its `{success, data}`; failures keep the API's status and message. */
export async function boxApi<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
	const { accessToken } = requireAuth();
	const { json, ...rest } = init;
	let res: Response;
	try {
		res = await fetch(`${boxApiUrl()}${path}`, {
			...rest,
			body: json === undefined ? rest.body : JSON.stringify(json),
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`, ...rest.headers }
		});
	} catch {
		error(502, 'The Locci Box API could not be reached');
	}
	const body = (await res.json().catch(() => ({}))) as { success?: boolean; data?: T; error?: string };
	if (!res.ok || body.success === false) error(res.status >= 400 ? res.status : 502, body.error ?? `Request failed (${res.status})`);
	return body.data as T;
}
