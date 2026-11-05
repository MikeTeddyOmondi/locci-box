import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** The console starts at the overview; signed-out visitors land on sign-in. */
export const load: PageServerLoad = async ({ locals }) => {
	redirect(303, locals.user ? '/dashboard' : '/login');
};
