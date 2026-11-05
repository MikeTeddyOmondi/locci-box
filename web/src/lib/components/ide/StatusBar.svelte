<script lang="ts">
	import { Box, CircleX, LoaderCircle, TriangleAlert } from '@lucide/svelte';

	/**
	 * The strip along the bottom, as VS Code's status bar: on the left where the
	 * code runs and its errors and warnings (a click opens Problems), on the
	 * right the cursor, indentation, encoding, line endings and language.
	 */

	interface Props {
		/** Where the code runs: the box and its state, or "Scratch". */
		target: string;
		busy?: string | null;
		errors: number;
		warnings: number;
		checking: boolean;
		line: number;
		column: number;
		tabSize: number;
		insertSpaces: boolean;
		language: string;
		onProblems: () => void;
	}

	let { target, busy = null, errors, warnings, checking, line, column, tabSize, insertSpaces, language, onProblems }: Props = $props();
</script>

<div class="flex h-6 shrink-0 items-center gap-0.5 bg-[#007acc] px-1 text-[11px] text-white select-none dark:bg-[#1f6feb]">
	<span class="flex items-center gap-1 px-1.5" title="Where this code runs">
		<Box class="size-3" />
		{target}
	</span>
	{#if busy}
		<span class="flex items-center gap-1 px-1.5"><LoaderCircle class="size-3 animate-spin" /> {busy}</span>
	{/if}
	<button type="button" class="flex cursor-pointer items-center gap-1 rounded-sm px-1.5 hover:bg-white/15" title="Problems: {errors} errors, {warnings} warnings" onclick={onProblems}>
		<CircleX class="size-3" />
		{errors}
		<TriangleAlert class="ml-1 size-3" />
		{warnings}
	</button>
	{#if checking}
		<span class="flex items-center gap-1 px-1.5 opacity-90"><LoaderCircle class="size-3 animate-spin" /> Checking...</span>
	{/if}
	<div class="flex-1"></div>
	<span class="px-1.5">Ln {line}, Col {column}</span>
	<span class="hidden px-1.5 sm:inline">{insertSpaces ? 'Spaces' : 'Tab Size'}: {tabSize}</span>
	<span class="hidden px-1.5 sm:inline">UTF-8</span>
	<span class="hidden px-1.5 sm:inline">LF</span>
	<span class="px-1.5">{language}</span>
</div>
