import { redirect } from '@sveltejs/kit';
import { authClient } from '$lib/server/locci-auth';
import { RETURN_COOKIE, saveTokens, VERIFIER_COOKIE } from '$lib/server/session';
import type { RequestHandler } from './$types';

/** Locci Auth sends the browser back here with a code; trade it for the session, as locci-platform does. */
export const GET: RequestHandler = async ({ url, cookies }) => {
	if (url.searchParams.get('error')) {
		redirect(302, `/login?error=${encodeURIComponent(url.searchParams.get('error_description') || 'cancelled')}`);
	}
	const code = url.searchParams.get('code');
	const verifier = cookies.get(VERIFIER_COOKIE);
	if (!code) redirect(302, '/login?error=no_code');
	if (!verifier) redirect(302, '/login?error=no_verifier');

	const result = await authClient().exchange(code, `${url.origin}/auth/callback`, verifier);
	if (result.err) redirect(302, '/login?error=exchange_failed');

	saveTokens(cookies, result.tokens);
	cookies.delete(VERIFIER_COOKIE, { path: '/' });
	const back = cookies.get(RETURN_COOKIE);
	cookies.delete(RETURN_COOKIE, { path: '/' });
	redirect(302, back?.startsWith('/') && !back.startsWith('//') ? back : '/dashboard');
};
