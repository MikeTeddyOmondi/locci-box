<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { MessageSquare, Plus, Trash2 } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import { confirmDialog } from '$lib/confirm.svelte';
	import { errMessage } from '$lib/utils';
	import { deleteThread, getThreads } from '../../bob.remote';

	/** BOB: past reviews on the left (on wide screens), the chat on the right. */

	let { children } = $props();
	const threadsQuery = getThreads();

	const activeId = $derived(page.url.pathname.split('/')[2] ?? null);

	async function remove(id: string, title: string) {
		const ok = await confirmDialog({
			title: 'Delete this review?',
			description: `"${title}" and its messages are deleted for good.`,
			confirmLabel: 'Delete',
			destructive: true
		});
		if (!ok) return;
		try {
			await deleteThread(id);
			if (activeId === id) goto('/bob');
		} catch (err) {
			toast.error(errMessage(err));
		}
	}
</script>

<svelte:head><title>BOB · Locci Box</title></svelte:head>

<div class="flex min-h-0 flex-1">
	<aside class="hidden w-64 shrink-0 flex-col border-r md:flex">
		<div class="flex items-center justify-between gap-2 border-b p-3">
			<div>
				<p class="text-sm font-semibold">BOB</p>
				<p class="text-xs text-muted-foreground">Code review and debugging</p>
			</div>
			<Button size="icon" variant="outline" href="/bob" aria-label="New review" data-sveltekit-reload={activeId === null ? true : undefined}>
				<Plus class="size-4" />
			</Button>
		</div>
		<nav class="flex-1 space-y-0.5 overflow-y-auto p-2" aria-label="Reviews">
			{#await threadsQuery}
				<p class="px-2 py-1 text-sm text-muted-foreground">Loading...</p>
			{:then threads}
				{#each threads as t (t.id)}
					<div
						class={[
							'group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm',
							activeId === t.id ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
						]}
					>
						<a href="/bob/{t.id}" class="flex min-w-0 flex-1 items-center gap-2">
							<MessageSquare class="size-3.5 shrink-0 text-muted-foreground" />
							<span class="truncate">{t.title}</span>
						</a>
						<button
							type="button"
							class="shrink-0 cursor-pointer text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive focus:opacity-100"
							aria-label="Delete {t.title}"
							onclick={() => remove(t.id, t.title)}
						>
							<Trash2 class="size-3.5" />
						</button>
					</div>
				{:else}
					<p class="px-2 py-1 text-sm text-muted-foreground">No reviews yet.</p>
				{/each}
			{:catch err}
				<p class="px-2 py-1 text-sm text-muted-foreground">{errMessage(err)}</p>
			{/await}
		</nav>
	</aside>

	<section class="flex min-h-0 min-w-0 flex-1 flex-col">
		{@render children()}
	</section>
</div>
