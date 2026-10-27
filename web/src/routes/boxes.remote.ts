import { command, query } from '$app/server';
import * as v from 'valibot';
import { boxApi } from '$lib/server/box-api';
import { LANGUAGES, type BoxExecResult, type BoxInfo } from '$lib/types';

/** Agent boxes: long-lived microVMs, the same operations as the box_* MCP tools. */

export const getBoxes = query(async () => boxApi<BoxInfo[]>('/api/boxes'));

export const createBox = command(v.optional(v.picklist(LANGUAGES)), async (language) => {
	const box = await boxApi<BoxInfo>('/api/boxes', { method: 'POST', json: { language } });
	await getBoxes().refresh();
	return box;
});

/** Start a stopped box again (its files and installs as they were). */
export const startBox = command(v.string(), async (id) => {
	const box = await boxApi<BoxInfo>('/api/boxes', { method: 'POST', json: { box_id: id } });
	await getBoxes().refresh();
	return box;
});

export const execInBox = command(
	v.object({
		id: v.string(),
		command: v.pipe(v.string(), v.nonEmpty()),
		timeout: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(600)))
	}),
	async ({ id, command: cmd, timeout }) =>
		boxApi<BoxExecResult>(`/api/boxes/${encodeURIComponent(id)}/exec`, {
			method: 'POST',
			json: { command: cmd, timeout }
		})
);

export const stopBox = command(v.string(), async (id) => {
	await boxApi(`/api/boxes/${encodeURIComponent(id)}/stop`, { method: 'POST' });
	await getBoxes().refresh();
	return { success: true as const };
});

export const removeBox = command(v.string(), async (id) => {
	await boxApi(`/api/boxes/${encodeURIComponent(id)}`, { method: 'DELETE' });
	await getBoxes().refresh();
	return { success: true as const };
});
