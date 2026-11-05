<script lang="ts">
	import { FileCode2, FolderCode, LoaderCircle, NotebookPen, Plus, Trash2 } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Select from '$lib/components/ui/select';
	import { confirmDialog } from '$lib/confirm.svelte';
	import { RUN_COMMAND } from '$lib/languages';
	import { LANGUAGE_LABELS, LANGUAGES, type BoxInfo, type Language } from '$lib/types';
	import { errMessage, formatDate } from '$lib/utils';
	import { createProject, deleteProject, getProjects } from '../../projects.remote';

	/**
	 * Code: projects, each in a box of its own (files, installs and a terminal
	 * kept between visits), and Scratch for one-off snippets.
	 */

	const projectsQuery = getProjects();

	let open = $state(false);
	let name = $state('');
	let language = $state<Language>('node');
	let creating = $state(false);
	let busy = $state<string | null>(null);

	/** What a new project starts with, by language. */
	const STARTS_WITH: Record<Language, string> = {
		node: 'npm init, index.js importing lib/math.js',
		python: 'main.py importing mathutils.py, requirements.txt',
		go: 'go mod init, main.go and fib.go',
		rust: 'cargo init, src/main.rs with a math module',
		c: 'Makefile, src/main.c, fib.c and fib.h',
		cpp: 'Makefile, src/main.cpp, fib.cpp and fib.h',
		ruby: 'main.rb requiring lib/fib.rb, a Gemfile',
		bash: 'main.sh sourcing lib.sh'
	};

	async function create(e: SubmitEvent) {
		e.preventDefault();
		if (!name.trim()) return;
		creating = true;
		try {
			const { box, initError } = await createProject({ name: name.trim(), language });
			if (initError) toast.warning(`The project is ready, but its setup reported: ${initError}`);
			open = false;
			name = '';
			await goto(`/code/${box.box_id}`);
		} catch (err) {
			toast.error(errMessage(err, 'The project could not be created'));
		} finally {
			creating = false;
		}
	}

	async function remove(project: BoxInfo) {
		const ok = await confirmDialog({
			title: `Delete ${project.name}?`,
			description: 'Its box and every file in it are deleted.',
			confirmLabel: 'Delete project',
			destructive: true
		});
		if (!ok) return;
		busy = project.box_id;
		try {
			await deleteProject(project.box_id);
			toast.success(`${project.name} deleted`);
		} catch (err) {
			toast.error(errMessage(err, 'The project could not be deleted'));
		} finally {
			busy = null;
		}
	}
</script>

<svelte:head><title>Code · Locci Box</title></svelte:head>

<div class="mx-auto w-full max-w-6xl space-y-6 p-4 lg:p-6">
	<div class="flex flex-wrap items-end justify-between gap-4">
		<div>
			<h1 class="text-3xl font-bold">Code</h1>
			<p class="mt-1 text-muted-foreground">
				Projects live in a box of their own: files import each other, packages you install stay, and the terminal is a real shell.
			</p>
		</div>
		<div class="flex items-center gap-2">
			<Button variant="outline" href="/code/scratch">
				<NotebookPen class="size-4" /> Scratch
			</Button>
			<Button onclick={() => (open = true)}>
				<Plus class="size-4" /> New project
			</Button>
		</div>
	</div>

	{#await projectsQuery}
		<p class="py-6 text-center text-sm text-muted-foreground">Loading...</p>
	{:then projects}
		{#if projects.length === 0}
			<Card.Root>
				<Card.Content class="flex flex-col items-center gap-2 py-10 text-center">
					<FolderCode class="size-8 text-muted-foreground" />
					<p class="font-medium">No projects yet</p>
					<p class="text-sm text-muted-foreground">Start one with npm init, cargo init or go mod init done for you, or try a snippet in Scratch.</p>
					<Button class="mt-2" onclick={() => (open = true)}><Plus class="size-4" /> New project</Button>
				</Card.Content>
			</Card.Root>
		{:else}
			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each projects as project (project.box_id)}
					<Card.Root class="group relative transition-colors hover:border-primary/50">
						<a href="/code/{project.box_id}" class="absolute inset-0 z-0" aria-label="Open {project.name}"></a>
						<Card.Header class="pb-2">
							<Card.Title class="flex items-center gap-2 text-base">
								<FileCode2 class="size-4 text-muted-foreground" />
								<span class="truncate">{project.name}</span>
							</Card.Title>
						</Card.Header>
						<Card.Content class="space-y-2 text-sm">
							<div class="flex items-center gap-2">
								<Badge variant="secondary">{project.language ? LANGUAGE_LABELS[project.language] : 'Node.js'}</Badge>
								<Badge variant={project.status === 'running' ? 'default' : 'outline'}>{project.status}</Badge>
							</div>
							<p class="font-mono text-xs text-muted-foreground">{project.box_id}</p>
							<p class="text-xs text-muted-foreground">Last used {formatDate(project.last_used_at)}</p>
						</Card.Content>
						<Button
							size="icon"
							variant="ghost"
							class="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 focus:opacity-100"
							aria-label="Delete {project.name}"
							disabled={busy === project.box_id}
							onclick={() => remove(project)}
						>
							<Trash2 class="size-4" />
						</Button>
					</Card.Root>
				{/each}
			</div>
		{/if}
	{:catch err}
		<p class="py-6 text-center text-sm text-destructive">{errMessage(err, 'Projects could not be loaded')}</p>
	{/await}
</div>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>New project</Dialog.Title>
			<Dialog.Description>A box of its own, set up as the language's tools would set it up.</Dialog.Description>
		</Dialog.Header>
		<form class="space-y-4" onsubmit={create}>
			<div class="space-y-2">
				<Label for="project-name">Name</Label>
				<Input id="project-name" bind:value={name} placeholder="my-app" maxlength={64} autocomplete="off" required />
			</div>
			<div class="space-y-2">
				<Label for="project-language">Language</Label>
				<Select.Root type="single" bind:value={language}>
					<Select.Trigger id="project-language" class="w-full">{LANGUAGE_LABELS[language]}</Select.Trigger>
					<Select.Content>
						{#each LANGUAGES as l (l)}
							<Select.Item value={l}>{LANGUAGE_LABELS[l]}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
				<p class="text-xs text-muted-foreground">
					Starts with {STARTS_WITH[language]}. Run: <span class="font-mono">{RUN_COMMAND[language]}</span>
				</p>
			</div>
			{#if creating}
				<p class="flex items-center gap-2 text-xs text-muted-foreground">
					<LoaderCircle class="size-3.5 shrink-0 animate-spin" />
					Setting up the box. A language's first project downloads its image, which can take a minute.
				</p>
			{/if}
			<Dialog.Footer>
				<Button type="button" variant="ghost" disabled={creating} onclick={() => (open = false)}>Cancel</Button>
				<Button type="submit" disabled={creating || !name.trim()}>
					{creating ? 'Creating...' : 'Create project'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
