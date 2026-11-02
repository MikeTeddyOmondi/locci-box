import { command, query } from '$app/server';
import { env as publicEnv } from '$env/dynamic/public';
import * as v from 'valibot';
import { boxApi } from '$lib/server/box-api';
import { LANGUAGES, type BoxInfo } from '$lib/types';

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

/**
 * Where the browser opens a box's terminal: the API's websocket with a
 * one-time ticket (good for 30 s). The browser connects to the API itself,
 * since adapter-node cannot proxy websockets, and the ticket stands in for the
 * access token, which stays in this server.
 */
export const terminalSession = command(v.string(), async (id) => {
	const { ticket } = await boxApi<{ ticket: string }>(`/api/boxes/${encodeURIComponent(id)}/terminal`, { method: 'POST' });
	const url = new URL(`/api/boxes/${encodeURIComponent(id)}/terminal`, publicEnv.PUBLIC_LOCCI_BOX_API_URL || 'http://localhost:5757');
	url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
	url.searchParams.set('ticket', ticket);
	return { url: url.toString() };
});

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
