import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

/** Every console page needs a signed-in user; others go to /login and come back. */
export const load: LayoutServerLoad = async ({ locals, url }) => {
	if (!locals.user) redirect(303, `/login?next=${encodeURIComponent(url.pathname + url.search)}`);
	return { user: locals.user };
};
