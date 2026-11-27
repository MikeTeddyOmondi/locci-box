import { json } from '@sveltejs/kit';
import { boxApiUrl } from '$lib/server/box-api';
import type { RequestHandler } from './$types';

/**
 * /api/* passes through to the Locci Box API's /api/* as the caller: the
 * session's user, or a script with `Authorization: Bearer` (a Locci access
 * token or API key, checked in hooks.server.ts). Kept as a route for what needs
 * a URL: the BOB chat stream (the AI SDK posts to /api/bob) and scripts. The
 * pages themselves use remote functions.
 *
 * Bodies stream both ways, so a chat reply arrives as it is written.
 */
const forward: RequestHandler = async ({ request, params, url, locals }) => {
	if (!locals.user || !locals.accessToken) {
		return json({ success: false, error: 'Sign in, or send Authorization: Bearer with a Locci API key' }, { status: 401 });
	}
	const headers = new Headers({ Authorization: `Bearer ${locals.accessToken}` });
	const type = request.headers.get('content-type');
	if (type) headers.set('content-type', type);
	const hasBody = request.method !== 'GET' && request.method !== 'HEAD';

	let upstream: Response;
	try {
		upstream = await fetch(`${boxApiUrl()}/api/${params.path}${url.search}`, {
			method: request.method,
			headers,
			body: hasBody ? request.body : undefined,
			signal: request.signal,
			// @ts-expect-error: Node's fetch needs this to stream a request body
			duplex: hasBody ? 'half' : undefined
		});
	} catch {
		return json({ success: false, error: 'The Locci Box API could not be reached' }, { status: 502 });
	}

	const out = new Headers();
	for (const name of ['content-type', 'cache-control', 'x-vercel-ai-ui-message-stream', 'retry-after']) {
		const value = upstream.headers.get(name);
		if (value) out.set(name, value);
	}
	return new Response(upstream.body, { status: upstream.status, headers: out });
};

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
