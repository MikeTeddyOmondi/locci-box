import { command, getRequestEvent } from '$app/server';
import * as v from 'valibot';
import { authClient } from '$lib/server/locci-auth';
import { clearTokens, RETURN_COOKIE, setShortLived, VERIFIER_COOKIE } from '$lib/server/session';

/**
 * Start a Locci Auth sign-in: the PKCE verifier stays here in an httpOnly
 * cookie, and the browser is sent to the returned URL.
 */
export const signIn = command(
	v.object({ returnTo: v.optional(v.string()), provider: v.optional(v.picklist(['github'])) }),
	async ({ returnTo, provider }) => {
	const { cookies, url } = getRequestEvent();
	// provider skips the issuer's picker and goes straight to that provider, as on locci-platform.
	const { challenge, url: authorizeUrl } = await authClient().authorize(`${url.origin}/auth/callback`, 'code', {
		pkce: true,
		provider
	});
	setShortLived(cookies, VERIFIER_COOKIE, challenge.verifier!);
	if (returnTo?.startsWith('/') && !returnTo.startsWith('//')) setShortLived(cookies, RETURN_COOKIE, returnTo);
	return { url: authorizeUrl };
	}
);

export const signOut = command(async () => {
	clearTokens(getRequestEvent().cookies);
	return { success: true as const };
});
