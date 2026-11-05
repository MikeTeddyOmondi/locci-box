<script lang="ts">
	import { Check, Copy } from '@lucide/svelte';
	import { highlightCode } from '$lib/markdown.svelte';

	/** A command or code sample, highlighted as `lang` (Shiki, as in BOB's replies), with a copy button. */
	let { code, lang = 'bash', label = 'Copy' }: { code: string; lang?: string; label?: string } = $props();
	let copied = $state(false);

	async function copy() {
		await navigator.clipboard.writeText(code);
		copied = true;
		setTimeout(() => (copied = false), 1600);
	}
</script>

<div class="group relative overflow-hidden rounded-md border bg-muted/40 text-xs leading-relaxed [&_pre]:overflow-x-auto [&_pre]:!bg-transparent [&_pre]:p-4 [&_pre]:pr-12 [&_pre]:font-mono">
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- Shiki escapes the code -->
	{@html highlightCode(code, lang)}
	<button
		type="button"
		onclick={copy}
		aria-label={copied ? 'Copied' : label}
		class="absolute top-2 right-2 flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
	>
		{#if copied}<Check class="size-4" />{:else}<Copy class="size-4" />{/if}
	</button>
</div>
