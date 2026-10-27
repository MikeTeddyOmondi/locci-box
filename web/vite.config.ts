import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	build: {
		// The biggest chunks are Monaco (loaded only by the Code and Playground
		// pages) and single Shiki grammars, fetched when a reply needs them.
		chunkSizeWarningLimit: 5000
	}
});
