import { command, query } from '$app/server';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';
import { requireAuth } from '$lib/server/box-api';
import { issuer } from '$lib/server/locci-auth';
import type { ApiKeySummary } from '$lib/types';

/**
 * Locci API keys, as locci-platform's keys.remote.ts manages them: issued and
 * revoked by Locci Auth, with the signed-in user's access token. A key works on
 * every Locci service; the Locci Box API, its MCP server and the CLI take it as
 * `Authorization: Bearer locci_sk_live_...` and trade it at Locci Auth.
 */

async function authFetch(path: string, init: RequestInit = {}) {
	const { accessToken } = requireAuth();
	const res = await fetch(`${issuer()}${path}`, {
		...init,
		headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`, ...init.headers }
	}).catch((err) => {
		console.error('Error reaching Locci Auth:', err);
		error(503, 'Could not reach Locci Auth');
	});
	if (!res.ok) {
		const detail = await res.text().catch(() => '');
		error(res.status === 404 ? 404 : 502, detail || res.statusText);
	}
	return res;
}

export const getApiKeys = query(async () => {
	const body = (await (await authFetch('/keys')).json()) as { keys?: ApiKeySummary[] };
	return body.keys ?? [];
});

/**
 * Create a key. The plaintext in the result is the only time it exists outside
 * the caller's hands: Locci Auth stores a hash. `expiresInDays: null` is never.
 */
export const createApiKey = command(
	v.object({
		name: v.pipe(v.string(), v.trim(), v.nonEmpty('Name the key'), v.maxLength(64)),
		expiresInDays: v.nullable(v.picklist([30, 90, 365]))
	}),
	async ({ name, expiresInDays }) => {
		const res = await authFetch('/keys', { method: 'POST', body: JSON.stringify({ name, expiresInDays }) });
		const body = (await res.json()) as { key: string; summary: ApiKeySummary };
		await getApiKeys().refresh();
		return body;
	}
);

/** Revoked rather than deleted, so a key seen in a log later can be explained. */
export const revokeApiKey = command(v.string(), async (id) => {
	await authFetch(`/keys/${encodeURIComponent(id)}`, { method: 'DELETE' });
	await getApiKeys().refresh();
	return { success: true as const, id };
});
