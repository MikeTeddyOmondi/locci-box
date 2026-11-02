<script lang="ts">
	import { Boxes, Play, Plus, Square, Terminal, Trash2 } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import BoxTerminalModal from '$lib/components/BoxTerminalModal.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Select from '$lib/components/ui/select';
	import * as Table from '$lib/components/ui/table';
	import { confirmDialog } from '$lib/confirm.svelte';
	import { LANGUAGE_LABELS, LANGUAGES, type BoxInfo, type Language } from '$lib/types';
	import { errMessage, formatDate } from '$lib/utils';
	import { createBox, getBoxes, removeBox, startBox, stopBox } from '../../boxes.remote';

	/**
	 * Agent boxes: long-lived microVMs, the ones AI agents get through the box_*
	 * MCP tools. Each language has its own image with the toolchain ready.
	 */

	const boxesQuery = getBoxes();

	let language = $state<Language>('node');
	let creating = $state(false);
	let busy = $state<string | null>(null);
	/** The box whose terminal is open, over the whole page. */
	let terminal = $state<BoxInfo | null>(null);

	/** The language an image belongs to, for the table. */
	function imageLabel(image: string): string {
		const name = image.split('/').at(-1) ?? image;
		return name.replace('golang', 'go');
	}

	async function create() {
		creating = true;
		try {
			const box = await createBox(language);
			toast.success(`Box ${box.box_id} is running`);
		} catch (err) {
			toast.error(errMessage(err, 'Could not create the box'));
		} finally {
			creating = false;
		}
	}

	async function act(box: BoxInfo, action: 'start' | 'stop' | 'remove') {
		if (action === 'remove') {
			const ok = await confirmDialog({
				title: `Delete ${box.box_id}?`,
				description: 'The box and its /workspace are deleted for good.',
				confirmLabel: 'Delete',
				destructive: true
			});
			if (!ok) return;
		}
		busy = box.box_id;
		try {
			if (action === 'start') await startBox(box.box_id);
			if (action === 'stop') await stopBox(box.box_id);
			if (action === 'remove') await removeBox(box.box_id);
		} catch (err) {
			toast.error(errMessage(err));
		} finally {
			busy = null;
		}
	}

	function closeTerminal(open: boolean) {
		if (open) return;
		terminal = null;
		// Opening the terminal started a stopped box.
		void getBoxes().refresh();
	}
</script>

<svelte:head><title>Boxes · Locci Box</title></svelte:head>

<div class="mx-auto w-full max-w-6xl space-y-6 p-4 lg:p-6">
	<div class="flex flex-wrap items-end justify-between gap-4">
		<div>
			<h1 class="text-3xl font-bold">Boxes</h1>
			<p class="mt-1 text-muted-foreground">
				Long-lived microVMs with apt, git and a language toolchain. They stop after 15 idle minutes and start again with their files.
			</p>
		</div>
		<div class="flex items-center gap-2">
			<Select.Root type="single" bind:value={language}>
				<Select.Trigger class="w-36" aria-label="Language">{LANGUAGE_LABELS[language]}</Select.Trigger>
				<Select.Content>
					{#each LANGUAGES as l (l)}
						<Select.Item value={l}>{LANGUAGE_LABELS[l]}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
			<Button onclick={create} disabled={creating}>
				<Plus class="size-4" />
				{creating ? 'Creating...' : 'New box'}
			</Button>
		</div>
	</div>

	<Card.Root>
		<Card.Content class="pt-6">
			{#await boxesQuery}
				<p class="py-6 text-center text-sm text-muted-foreground">Loading...</p>
			{:then boxes}
				{#if boxes.length === 0}
					<div class="flex flex-col items-center gap-2 py-10 text-center">
						<Boxes class="size-8 text-muted-foreground" />
						<p class="font-medium">No boxes yet</p>
						<p class="text-sm text-muted-foreground">Create one, or let an agent create one with the box_create MCP tool.</p>
					</div>
				{:else}
					<div class="overflow-x-auto">
						<Table.Root>
							<Table.Header>
								<Table.Row>
									<Table.Head>Box</Table.Head>
									<Table.Head>Image</Table.Head>
									<Table.Head>Status</Table.Head>
									<Table.Head>Last used</Table.Head>
									<Table.Head class="text-right">Actions</Table.Head>
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{#each boxes as box (box.box_id)}
									<Table.Row>
										<Table.Cell class="font-mono text-xs">{box.box_id}</Table.Cell>
										<Table.Cell class="font-mono text-xs">{imageLabel(box.image)}</Table.Cell>
										<Table.Cell>
											<Badge variant={box.status === 'running' ? 'default' : 'secondary'}>{box.status}</Badge>
										</Table.Cell>
										<Table.Cell class="text-muted-foreground">{formatDate(box.last_used_at)}</Table.Cell>
										<Table.Cell>
											<div class="flex justify-end gap-1">
												<Button size="icon" variant="ghost" aria-label="Terminal" title="Terminal" onclick={() => (terminal = box)}>
													<Terminal class="size-4" />
												</Button>
												{#if box.status === 'running'}
													<Button size="icon" variant="ghost" aria-label="Stop" disabled={busy === box.box_id} onclick={() => act(box, 'stop')}>
														<Square class="size-4" />
													</Button>
												{:else}
													<Button size="icon" variant="ghost" aria-label="Start" disabled={busy === box.box_id} onclick={() => act(box, 'start')}>
														<Play class="size-4" />
													</Button>
												{/if}
												<Button size="icon" variant="ghost" aria-label="Delete" disabled={busy === box.box_id} onclick={() => act(box, 'remove')}>
													<Trash2 class="size-4" />
												</Button>
											</div>
										</Table.Cell>
									</Table.Row>
								{/each}
							</Table.Body>
						</Table.Root>
					</div>
				{/if}
			{:catch err}
				<p class="py-6 text-center text-sm text-muted-foreground">{errMessage(err)}</p>
			{/await}
		</Card.Content>
	</Card.Root>

</div>

<BoxTerminalModal box={terminal} onOpenChange={closeTerminal} />
