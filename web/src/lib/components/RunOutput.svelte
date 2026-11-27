<script lang="ts">
	import { CircleCheck, CircleX, LoaderCircle, Timer } from '@lucide/svelte';

	/** The result of a run: exit code, time, then stdout and stderr. */

	export interface RunResult {
		stdout: string;
		stderr: string;
		exit: number;
		ms: number;
		/** A message instead of a result (the API refused the run). */
		error?: string;
	}

	let { result, running = false, empty = 'Run the code to see its output here.' }: {
		result: RunResult | null;
		running?: boolean;
		empty?: string;
	} = $props();
</script>

<div class="flex h-full min-h-0 flex-col">
	<div class="flex items-center gap-3 border-b px-3 py-2 text-xs">
		<span class="font-semibold">Output</span>
		{#if running}
			<span class="inline-flex items-center gap-1 text-muted-foreground"><LoaderCircle class="size-3.5 animate-spin" /> running in a microVM</span>
		{:else if result && !result.error}
			{#if result.exit === 0}
				<span class="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><CircleCheck class="size-3.5" /> exit 0</span>
			{:else}
				<span class="inline-flex items-center gap-1 text-destructive"><CircleX class="size-3.5" /> exit {result.exit}</span>
			{/if}
			<span class="inline-flex items-center gap-1 text-muted-foreground"><Timer class="size-3.5" /> {result.ms} ms</span>
		{/if}
	</div>
	<div class="min-h-0 flex-1 overflow-auto p-3 font-mono text-xs leading-relaxed">
		{#if result?.error}
			<p class="text-destructive">{result.error}</p>
		{:else if result}
			{#if result.stdout}<pre class="whitespace-pre-wrap">{result.stdout}</pre>{/if}
			{#if result.stderr}<pre class="whitespace-pre-wrap text-destructive">{result.stderr}</pre>{/if}
			{#if !result.stdout && !result.stderr}<p class="text-muted-foreground">(no output)</p>{/if}
		{:else if !running}
			<p class="text-muted-foreground">{empty}</p>
		{/if}
	</div>
</div>
