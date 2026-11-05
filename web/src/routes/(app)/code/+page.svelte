<script lang="ts">
	import { Download, FilePlus, FileCode2, Play, Trash2 } from '@lucide/svelte';
	import { onMount, tick } from 'svelte';
	import { toast } from 'svelte-sonner';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import RunOutput, { type RunResult } from '$lib/components/RunOutput.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Select from '$lib/components/ui/select';
	import { EXTENSION, HELLO, languageOf, MONACO_LANGUAGE } from '$lib/languages';
	import { LANGUAGE_LABELS, LANGUAGES, type Language } from '$lib/types';
	import { confirmDialog } from '$lib/confirm.svelte';
	import { errMessage } from '$lib/utils';
	import { runCode } from '../../sandbox.remote';

	/**
	 * A small editor: files kept in this browser, Monaco, and Run, which sends
	 * the open file to a fresh microVM (run_sandbox) and shows what it printed.
	 */

	interface FileEntry {
		id: string;
		name: string;
		language: Language;
		content: string;
	}

	const STORAGE_KEY = 'locci-box.files';

	const starter = (language: Language, name = `main.${EXTENSION[language]}`): FileEntry => ({
		id: crypto.randomUUID(),
		name,
		language,
		content: HELLO[language]
	});

	const first = starter('python');
	let files = $state<FileEntry[]>([first]);
	let activeId = $state(first.id);
	let running = $state(false);
	let result = $state<RunResult | null>(null);
	let renaming = $state<string | null>(null);

	const active = $derived(files.find((f) => f.id === activeId) ?? files[0]);

	onMount(() => {
		try {
			const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as FileEntry[] | null;
			if (saved?.length) {
				files = saved;
				activeId = saved[0].id;
			}
		} catch {
			// nothing saved, or unreadable: keep the starter
		}
	});

	// Kept as you type, in this browser only.
	$effect(() => {
		const snapshot = JSON.stringify(files);
		try {
			localStorage.setItem(STORAGE_KEY, snapshot);
		} catch {
			// storage full or blocked: the files still live until the tab closes
		}
	});

	function newFile(language: Language = active.language) {
		const taken = new Set(files.map((f) => f.name));
		let n = 1;
		while (taken.has(`untitled-${n}.${EXTENSION[language]}`)) n++;
		const file = starter(language, `untitled-${n}.${EXTENSION[language]}`);
		files.push(file);
		activeId = file.id;
	}

	function removeFile(id: string) {
		if (files.length === 1) return toast.error('Keep at least one file');
		const i = files.findIndex((f) => f.id === id);
		files.splice(i, 1);
		if (activeId === id) activeId = files[Math.max(0, i - 1)].id;
	}

	function rename(file: FileEntry, name: string) {
		renaming = null;
		const trimmed = name.trim();
		if (!trimmed || trimmed === file.name) return;
		file.name = trimmed;
		file.language = languageOf(trimmed) ?? file.language;
	}

	/** What the language dropdown shows; put back when a switch is cancelled. */
	let picked = $state<Language>('python');
	$effect(() => {
		picked = active.language;
	});

	/**
	 * Switch the open file to another language and load that language's sample.
	 * When the file holds code someone wrote (anything but an untouched sample
	 * or nothing), ask first; keeping the code cancels the switch entirely.
	 */
	async function setLanguage(language: Language) {
		const file = active;
		if (language === file.language) return;
		const untouched = !file.content.trim() || Object.values(HELLO).some((sample) => sample.trim() === file.content.trim());
		const go =
			untouched ||
			(await confirmDialog({
				title: `Switch to ${LANGUAGE_LABELS[language]}?`,
				description: `This loads the ${LANGUAGE_LABELS[language]} sample and replaces the code in ${file.name}.`,
				confirmLabel: `Switch to ${LANGUAGE_LABELS[language]}`,
				cancelLabel: 'Keep my code'
			}));
		if (!go) {
			// The dropdown already shows the new choice: put it back.
			await tick();
			picked = file.language;
			return;
		}
		file.language = language;
		file.name = file.name.replace(/\.[^.]*$/, '') + `.${EXTENSION[language]}`;
		file.content = HELLO[language];
		result = null;
	}

	function download() {
		const url = URL.createObjectURL(new Blob([active.content], { type: 'text/plain' }));
		const a = Object.assign(document.createElement('a'), { href: url, download: active.name });
		a.click();
		URL.revokeObjectURL(url);
	}

	async function run() {
		if (running || !active.content.trim()) return;
		running = true;
		result = null;
		try {
			const r = await runCode({ language: active.language, code: active.content, timeout: 30 });
			result = { stdout: r.stdout, stderr: r.stderr, exit: r.exit_code, ms: r.duration_ms };
		} catch (err) {
			result = { stdout: '', stderr: '', exit: 1, ms: 0, error: errMessage(err, 'The run failed') };
		} finally {
			running = false;
		}
	}
</script>

<svelte:head><title>Code · Locci Box</title></svelte:head>

<div class="flex min-h-0 flex-1 flex-col lg:flex-row">
	<!-- Files -->
	<aside class="flex shrink-0 flex-col border-b lg:w-56 lg:border-r lg:border-b-0">
		<div class="flex items-center justify-between px-3 py-2">
			<span class="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Files</span>
			<Button size="icon" variant="ghost" aria-label="New file" onclick={() => newFile()}>
				<FilePlus class="size-4" />
			</Button>
		</div>
		<ul class="flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-col lg:overflow-y-auto">
			{#each files as file (file.id)}
				<li
					class={[
						'group flex shrink-0 items-center gap-2 rounded-md px-2 py-1.5 font-mono text-xs',
						file.id === activeId ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50'
					]}
				>
					<FileCode2 class="size-3.5 shrink-0" />
					{#if renaming === file.id}
						<input
							class="min-w-0 flex-1 rounded border bg-background px-1"
							value={file.name}
							aria-label="File name"
							{@attach (node: HTMLInputElement) => node.select()}
							onblur={(e) => rename(file, e.currentTarget.value)}
							onkeydown={(e) => {
								if (e.key === 'Enter') rename(file, e.currentTarget.value);
								if (e.key === 'Escape') renaming = null;
							}}
						/>
					{:else}
						<button
							type="button"
							class="min-w-0 flex-1 cursor-pointer truncate text-left"
							title="Double-click to rename"
							onclick={() => (activeId = file.id)}
							ondblclick={() => (renaming = file.id)}
						>
							{file.name}
						</button>
					{/if}
					<button
						type="button"
						class="cursor-pointer opacity-0 group-hover:opacity-100 hover:text-destructive focus:opacity-100"
						aria-label="Delete {file.name}"
						onclick={() => removeFile(file.id)}
					>
						<Trash2 class="size-3.5" />
					</button>
				</li>
			{/each}
		</ul>
	</aside>

	<!-- Editor and output -->
	<div class="flex min-h-0 min-w-0 flex-1 flex-col">
		<div class="flex flex-wrap items-center gap-2 border-b px-3 py-2">
			<span class="font-mono text-sm">{active.name}</span>
			<div class="flex-1"></div>
			<Select.Root type="single" bind:value={picked} onValueChange={(v) => setLanguage(v as Language)}>
				<Select.Trigger class="h-8 w-32" aria-label="Language">{LANGUAGE_LABELS[picked]}</Select.Trigger>
				<Select.Content>
					{#each LANGUAGES as l (l)}
						<Select.Item value={l}>{LANGUAGE_LABELS[l]}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
			<Button size="icon" variant="ghost" aria-label="Download {active.name}" onclick={download}>
				<Download class="size-4" />
			</Button>
			<Button size="sm" onclick={run} disabled={running} title="Run (Cmd/Ctrl + Enter)">
				<Play class="size-4" />
				{running ? 'Running...' : 'Run'}
			</Button>
		</div>
		<div class="grid min-h-0 flex-1 grid-rows-[minmax(16rem,1fr)_minmax(10rem,40%)] xl:grid-cols-[1fr_24rem] xl:grid-rows-1">
			{#key active.id}
				<CodeEditor bind:value={active.content} language={MONACO_LANGUAGE[active.language]} onRun={run} class="h-full" />
			{/key}
			<div class="min-h-0 border-t xl:border-t-0 xl:border-l">
				<RunOutput {result} {running} />
			</div>
		</div>
	</div>
</div>
