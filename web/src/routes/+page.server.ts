import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** Signed-in users go straight to the console; everyone else gets the landing page. */
export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) redirect(303, '/dashboard');
};
