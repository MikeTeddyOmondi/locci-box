<script lang="ts">
	import { RotateCcw, Terminal, X } from '@lucide/svelte';
	import * as Dialog from '$lib/components/ui/dialog';
	import BoxTerminal from './BoxTerminal.svelte';

	/** A box's terminal over the whole page, after iaas-service's vm-terminal-modal.svelte. */

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
		class="bg-[#0a0a0a]"
	>
		<Dialog.Header class="flex shrink-0 flex-row items-center justify-between border-b border-zinc-800 px-4 py-3">
			<Dialog.Title class="flex items-center gap-2 font-mono text-sm font-medium text-zinc-300">
				<Terminal class="size-4" />
				{box?.box_id}
				<span class="text-zinc-500">{language}</span>
			</Dialog.Title>
			<Dialog.Description class="sr-only">An interactive shell in the box, in /workspace</Dialog.Description>
			<div class="flex items-center gap-3">
				{#if closed}
					<button
						type="button"
						class="flex cursor-pointer items-center gap-1 text-xs text-zinc-400 transition-colors hover:text-zinc-200"
						onclick={() => {
							closed = false;
							session++;
						}}
					>
						<RotateCcw class="size-3.5" /> Reconnect
					</button>
				{/if}
				<button
					type="button"
					onclick={() => onOpenChange(false)}
					class="cursor-pointer text-zinc-500 transition-colors hover:text-zinc-300"
					aria-label="Close terminal"
				>
					<X class="size-4" />
				</button>
			</div>
		</Dialog.Header>
		<div class="flex-1 overflow-hidden p-1">
			{#if box}
				{#key `${box.box_id}:${session}`}
					<BoxTerminal boxId={box.box_id} onClose={() => (closed = true)} />
				{/key}
			{/if}
		</div>
	</Dialog.Content>
</Dialog.Root>
