<script lang="ts">
	import { FileCode2, X } from '@lucide/svelte';

	/** Open files above the editor, as VS Code's tabs: a dot while unsaved, X to close, middle click closes too. */

	interface Props {
		tabs: { path: string; dirty: boolean; errors: number }[];
		active: string | null;
		onSelect: (path: string) => void;
		onClose: (path: string) => void;
	}

	let { tabs, active, onSelect, onClose }: Props = $props();

	const nameOf = (path: string) => path.split('/').at(-1) ?? path;
</script>

<div class="flex shrink-0 overflow-x-auto border-b bg-muted/40" role="tablist">
	{#each tabs as tab (tab.path)}
		<div
			class={[
				'group flex shrink-0 items-center gap-1.5 border-r px-3 py-1.5 font-mono text-xs',
				tab.path === active ? 'bg-background text-foreground' : 'text-muted-foreground hover:bg-background/60'
			]}
			role="tab"
			tabindex="0"
			aria-selected={tab.path === active}
			title={tab.path}
			onclick={() => onSelect(tab.path)}
			onauxclick={(e) => e.button === 1 && onClose(tab.path)}
			onkeydown={(e) => e.key === 'Enter' && onSelect(tab.path)}
		>
			<FileCode2 class="size-3.5 shrink-0" />
			<span class={tab.errors ? 'text-red-600 dark:text-red-400' : ''}>{nameOf(tab.path)}</span>
			{#if tab.errors}<span class="text-[10px] text-red-600 dark:text-red-400">{tab.errors}</span>{/if}
			<button
				type="button"
				class="grid size-4 cursor-pointer place-items-center rounded hover:bg-accent"
				aria-label="Close {nameOf(tab.path)}"
				onclick={(e) => {
					e.stopPropagation();
					onClose(tab.path);
				}}
			>
				{#if tab.dirty}
					<span class="size-2 rounded-full bg-foreground/70 group-hover:hidden"></span>
					<X class="hidden size-3 group-hover:block" />
				{:else}
					<X class={['size-3', tab.path === active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100']} />
				{/if}
			</button>
		</div>
	{/each}
</div>
