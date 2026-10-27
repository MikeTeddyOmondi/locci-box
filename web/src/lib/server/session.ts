import type { Cookies } from '@sveltejs/kit';
import { dev } from '$app/environment';

/** Session cookies. Named for this app, so another Locci console on localhost does not overwrite them. */
export const ACCESS_COOKIE = 'box_access_token';
export const REFRESH_COOKIE = 'box_refresh_token';
export const VERIFIER_COOKIE = 'box_pkce_verifier';
export const RETURN_COOKIE = 'box_return_to';

const options = { path: '/', httpOnly: true, secure: !dev, sameSite: 'lax' as const };

export function saveTokens(cookies: Cookies, tokens: { access: string; refresh: string }): void {
	cookies.set(ACCESS_COOKIE, tokens.access, { ...options, maxAge: 60 * 60 * 24 * 7 });
	cookies.set(REFRESH_COOKIE, tokens.refresh, { ...options, maxAge: 60 * 60 * 24 * 30 });
}

export function clearTokens(cookies: Cookies): void {
	cookies.delete(ACCESS_COOKIE, { path: '/' });
	cookies.delete(REFRESH_COOKIE, { path: '/' });
}

export function setShortLived(cookies: Cookies, name: string, value: string): void {
	cookies.set(name, value, { ...options, maxAge: 600 });
}
