import { command, query } from '$app/server';
import * as v from 'valibot';
import { boxApi } from '$lib/server/box-api';
import { LANGUAGES, type SandboxInfo, type SandboxResult, type StatsData } from '$lib/types';

/** Runs, usage and the sandboxes running now, for the signed-in user. */

export const getStats = query(async () => boxApi<StatsData>('/api/stats'));

export const getActiveSandboxes = query(async () => boxApi<SandboxInfo[]>('/api/sandbox'));

/** Run code once in a fresh microVM. A 503 means that language's image is still downloading on the host. */
export const runCode = command(
	v.object({
		language: v.picklist(LANGUAGES),
		code: v.pipe(v.string(), v.nonEmpty('Write some code first')),
		timeout: v.optional(v.pipe(v.number(), v.minValue(1))) // the API enforces its own maximum
	}),
	async (params) => boxApi<SandboxResult>('/api/sandbox/run', { method: 'POST', json: params })
);

export const stopSandbox = command(v.string(), async (id) => {
	await boxApi(`/api/sandbox/${encodeURIComponent(id)}`, { method: 'DELETE' });
	await getActiveSandboxes().refresh();
	return { success: true as const };
});
