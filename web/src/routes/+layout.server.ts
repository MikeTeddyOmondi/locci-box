import type { LayoutServerLoad } from './$types';

/** The signed-in user (or null) for every page. */
export const load: LayoutServerLoad = async ({ locals }) => ({ user: locals.user ?? null });
