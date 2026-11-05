import type { Handle } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { AuthUnavailableError, exchangeApiKey, LOCCI_KEY_PREFIX, verifyAccessToken } from '$lib/server/locci-auth';
import { ACCESS_COOKIE, clearTokens, REFRESH_COOKIE, saveTokens } from '$lib/server/session';

/**
 * Who is calling, for every request:
 *
 *   - a browser: the Locci Auth session in this app's httpOnly cookies, verified
 *     and refreshed here, as locci-platform does;
 *   - a script on /api: `Authorization: Bearer` with a Locci access token or a
 *     Locci API key (`locci_sk_live_...`, traded at Locci Auth's /keys/token).
 *
 * Either way locals.user and locals.accessToken are set, and the Locci Box API
 * is called with that access token. As in locci-storage's API, an issuer that
 * cannot be reached is a 503 and never a 401: the credential may be fine.
 */

const SKIP = /^\/(auth\/callback|favicon|robots\.txt|logo-|apple-touch-icon|_app\/)/;

async function fromBearer(header: string): Promise<{ user: App.Locals['user']; token: string } | null> {
	let token = header.slice('Bearer '.length).trim();
	if (token.startsWith(LOCCI_KEY_PREFIX)) {
		const exchanged = await exchangeApiKey(token);
		if (!exchanged) return null;
		token = exchanged;
	}
	const verified = await verifyAccessToken(token);
	if (verified.err) return null;
	return { user: verified.subject.properties, token };
}

export const handle: Handle = async ({ event, resolve }) => {
	if (SKIP.test(event.url.pathname)) return resolve(event);

	try {
		const header = event.request.headers.get('authorization');
		if (header?.startsWith('Bearer ')) {
			const caller = await fromBearer(header);
			if (!caller) return json({ success: false, error: 'Invalid credentials' }, { status: 401 });
			event.locals.user = caller.user;
			event.locals.accessToken = caller.token;
			return resolve(event);
		}

		const access = event.cookies.get(ACCESS_COOKIE);
		if (access) {
			const verified = await verifyAccessToken(access, event.cookies.get(REFRESH_COOKIE));
			if (verified.err) {
				clearTokens(event.cookies);
			} else {
				event.locals.user = verified.subject.properties;
				event.locals.accessToken = verified.tokens?.access ?? access;
				if (verified.tokens) saveTokens(event.cookies, verified.tokens);
			}
		}
	} catch (error) {
		if (!(error instanceof AuthUnavailableError)) throw error;
		console.error('Locci Auth unreachable:', error.cause);
		if (event.url.pathname.startsWith('/api/')) {
			return json({ success: false, error: 'Could not verify the credential right now; retry shortly' }, { status: 503 });
		}
		return new Response('Locci Auth is unreachable right now; retry shortly.', { status: 503 });
	}

	return resolve(event);
};
