import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	// Browser-only (loaded on demand in the page), so kept out of the server
	// bundle: bundling them there ran the image build out of memory.
	ssr: { external: ['monaco-editor', 'shiki'] },
	build: {
		// The biggest chunks are Monaco (loaded only by the Code and Playground
		// pages) and single Shiki grammars, fetched when a reply needs them.
		chunkSizeWarningLimit: 5000
	}
});
