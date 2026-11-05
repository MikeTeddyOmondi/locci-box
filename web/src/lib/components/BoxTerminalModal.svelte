<script lang="ts">
	import { RotateCcw, Terminal, X } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Select from '$lib/components/ui/select';
	import { terminalTheme } from '$lib/terminal-theme.svelte';
	import BoxTerminal, { TERMINAL_THEMES } from './BoxTerminal.svelte';

	/**
	 * A box's terminal over the whole page, after iaas-service's
	 * vm-terminal-modal.svelte. The header follows the console's light or dark
	 * theme; the terminal's own theme is picked here and remembered in this
	 * browser, for each mode.
	 */

	let {
		box,
		onOpenChange
	}: { box: { box_id: string; image: string } | null; onOpenChange: (open: boolean) => void } = $props();

	/** Bumped by Reconnect, for a fresh session in the same modal. */
	let session = $state(0);
	let closed = $state(false);
	// Each box opened starts with a live session.
	$effect(() => {
		if (box) closed = false;
	});

	onMount(() => terminalTheme.load());
	const theme = $derived(terminalTheme.current);

	const language = $derived(box ? (box.image.split('/').at(-1) ?? box.image).replace('golang', 'go') : '');
</script>

<Dialog.Root open={box !== null} {onOpenChange}>
	<!--
		Keys belong to the shell, not the dialog:
		- Escape (vi, less, readline) must not close it; the X button is the only way out.
		- Tab (completion) must not be taken by the focus trap, which would move focus to the X
		  button so the next Enter closes the session. The content covers the whole viewport, so
		  there is nothing outside to trap focus away from anyway.
	-->
	<Dialog.Content
		fullscreen
		showCloseButton={false}
		escapeKeydownBehavior="ignore"
		interactOutsideBehavior="ignore"
		trapFocus={false}
		class="bg-background text-foreground"
	>
		<Dialog.Header class="flex shrink-0 flex-row items-center justify-between border-b px-4 py-2">
			<Dialog.Title class="flex items-center gap-2 font-mono text-sm font-medium">
				<Terminal class="size-4" />
				{box?.box_id}
				<span class="text-muted-foreground">{language}</span>
			</Dialog.Title>
			<Dialog.Description class="sr-only">An interactive shell in the box, in /workspace</Dialog.Description>
			<div class="flex items-center gap-3">
				{#if closed}
					<button
						type="button"
						class="flex cursor-pointer items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
						onclick={() => {
							closed = false;
							session++;
						}}
					>
						<RotateCcw class="size-3.5" /> Reconnect
					</button>
				{/if}
				<Select.Root type="single" value={theme} onValueChange={(v) => terminalTheme.set(v)}>
					<Select.Trigger size="sm" class="h-7 w-36 text-xs" aria-label="Terminal theme">{TERMINAL_THEMES[theme].label}</Select.Trigger>
					<Select.Content>
						{#each Object.entries(TERMINAL_THEMES) as [value, { label }] (value)}
							<Select.Item {value} class="text-xs">{label}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
				<button
					type="button"
					onclick={() => onOpenChange(false)}
					class="cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
					aria-label="Close terminal"
				>
					<X class="size-4" />
				</button>
			</div>
		</Dialog.Header>
		<div class="flex-1 overflow-hidden p-1">
			{#if box}
				{#key `${box.box_id}:${session}`}
					<BoxTerminal boxId={box.box_id} {theme} onClose={() => (closed = true)} />
				{/key}
			{/if}
		</div>
	</Dialog.Content>
</Dialog.Root>
