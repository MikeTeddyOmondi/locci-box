// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	namespace App {
		interface Error {
			message: string;
		}
		interface Locals {
			/** The signed-in Locci user, from the session cookie or a bearer token or API key. */
			user?: { id: string; email: string };
			/** Their Locci Auth access token, sent on to the Locci Box API. */
			accessToken?: string;
		}
	}
}

export {};
