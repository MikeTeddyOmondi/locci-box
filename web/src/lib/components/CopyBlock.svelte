<script lang="ts">
	import { Check, Copy } from '@lucide/svelte';

	/** A command or code sample with a copy button. */
	let { code, label = 'Copy' }: { code: string; label?: string } = $props();
	let copied = $state(false);

	async function copy() {
		await navigator.clipboard.writeText(code);
		copied = true;
		setTimeout(() => (copied = false), 1600);
	}
</script>

<div class="group relative">
	<pre class="overflow-x-auto rounded-md border bg-muted/40 p-4 pr-12 font-mono text-xs leading-relaxed"><code>{code}</code></pre>
	<button
		type="button"
		onclick={copy}
		aria-label={copied ? 'Copied' : label}
		class="absolute top-2 right-2 flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
	>
		{#if copied}<Check class="size-4" />{:else}<Copy class="size-4" />{/if}
	</button>
</div>
