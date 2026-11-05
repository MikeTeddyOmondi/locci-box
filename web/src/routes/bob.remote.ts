import { command, query } from '$app/server';
import type { UIMessage } from 'ai';
import * as v from 'valibot';
import { boxApi } from '$lib/server/box-api';
import type { BobThread } from '$lib/types';

/**
 * BOB's conversations, kept by the Locci Box API per user. The chat itself
 * streams through /api/bob (a route, since the AI SDK posts to a URL).
 */

export const getThreads = query(async () => boxApi<BobThread[]>('/api/bob/threads'));

export const getThreadMessages = query(v.string(), async (id) =>
	boxApi<UIMessage[]>(`/api/bob/threads/${encodeURIComponent(id)}/messages`)
);

export const createThread = command(v.optional(v.string()), async (title) => {
	const thread = await boxApi<BobThread>('/api/bob/threads', { method: 'POST', json: { title: title ?? 'New review' } });
	await getThreads().refresh();
	return thread;
});

export const renameThread = command(
	v.object({ id: v.string(), title: v.pipe(v.string(), v.trim(), v.nonEmpty(), v.maxLength(120)) }),
	async ({ id, title }) => {
		await boxApi(`/api/bob/threads/${encodeURIComponent(id)}`, { method: 'PATCH', json: { title } });
		await getThreads().refresh();
		return { success: true as const };
	}
);

export const deleteThread = command(v.string(), async (id) => {
	await boxApi(`/api/bob/threads/${encodeURIComponent(id)}`, { method: 'DELETE' });
	await getThreads().refresh();
	return { success: true as const };
});
