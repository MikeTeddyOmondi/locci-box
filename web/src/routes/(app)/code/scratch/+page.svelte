<script lang="ts">
	import {
		ArrowLeft,
		CircleAlert,
		CircleX,
		Download,
		FilePlus,
		FileCode2,
		Info,
		LoaderCircle,
		Play,
		SquareChevronRight,
		Trash2,
		TriangleAlert
	} from '@lucide/svelte';
	import { onMount, tick } from 'svelte';
	import { toast } from 'svelte-sonner';
	import type * as Monaco from 'monaco-editor';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import RunOutput, { type RunResult } from '$lib/components/RunOutput.svelte';
	import StatusBar from '$lib/components/ide/StatusBar.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Select from '$lib/components/ui/select';
	import { parseDiagnostics } from '$lib/diagnostics';
	import { EXTENSION, HELLO, INDENT, languageOf, MONACO_LANGUAGE } from '$lib/languages';
	import { setCheckerMarkers, workerDiagnostics } from '$lib/monaco';
	import { LANGUAGE_LABELS, LANGUAGES, type Diagnostic, type Language } from '$lib/types';
	import { confirmDialog } from '$lib/confirm.svelte';
	import { errMessage } from '$lib/utils';
	import { runCode } from '../../../sandbox.remote';

	/**
	 * Scratch: files kept in this browser, Monaco, and Run, which sends the open
	 * file to a fresh microVM (run_sandbox) and shows what it printed. JavaScript
	 * is checked as you type; for the other languages, a failed run's errors
	 * are marked on their lines. Projects (a box each) are on /code.
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

	/** Each file's model sits in a folder of its own (file:///scratch/<id>/<name>): files here don't import each other. */
	const rootOf = (file: FileEntry) => `scratch/${file.id}`;

	let monaco: typeof Monaco | null = null;
	let markerListener: Monaco.IDisposable | undefined;
	let cursor = $state({ line: 1, column: 1 });
	let rightTab = $state<'output' | 'problems'>('output');
	/** The TypeScript worker's findings for the open file, and the last failed run's, per file. */
	let workerProblems = $state<Diagnostic[]>([]);
	let runProblems = $state<Record<string, Diagnostic[]>>({});
	const problems = $derived([...(runProblems[active.id] ?? []), ...workerProblems]);
	const errorCount = $derived(problems.filter((p) => p.severity === 'error').length);
	const warningCount = $derived(problems.filter((p) => p.severity === 'warning').length);

	function onEditorReady(m: typeof Monaco) {
		monaco = m;
		markerListener?.dispose();
		markerListener = m.editor.onDidChangeMarkers(() => (workerProblems = workerDiagnostics(m, rootOf(active))));
		workerProblems = workerDiagnostics(m, rootOf(active));
	}

	// Another file open: its findings, and its last run's markers back on it.
	$effect(() => {
		const file = active;
		const list = runProblems[file.id] ?? [];
		if (!monaco) return;
		workerProblems = workerDiagnostics(monaco, rootOf(file));
		tick().then(() => monaco && setCheckerMarkers(monaco, rootOf(file), list));
	});

	onMount(() => () => markerListener?.dispose());

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
		const file = active;
		try {
			const r = await runCode({ language: file.language, code: file.content, timeout: 30 });
			result = { stdout: r.stdout, stderr: r.stderr, exit: r.exit_code, ms: r.duration_ms };
			// The run's file is main.<ext> in the sandbox: what it reports is this file.
			const found =
				r.exit_code === 0 ? [] : parseDiagnostics(file.language, `${r.stderr}\n${r.stdout}`).map((d) => ({ ...d, path: file.name }));
			runProblems[file.id] = found;
			if (found.length) rightTab = 'problems';
		} catch (err) {
			result = { stdout: '', stderr: '', exit: 1, ms: 0, error: errMessage(err, 'The run failed') };
		} finally {
			running = false;
		}
	}
</script>

<svelte:head><title>Scratch · Code · Locci Box</title></svelte:head>

<div class="flex min-h-0 flex-1 flex-col">
<div class="flex min-h-0 flex-1 flex-col lg:flex-row">
	<!-- Files -->
	<aside class="flex shrink-0 flex-col border-b lg:w-56 lg:border-r lg:border-b-0">
		<div class="flex items-center justify-between px-2 py-2">
			<Button size="icon" variant="ghost" href="/code" aria-label="All projects" title="All projects">
				<ArrowLeft class="size-4" />
			</Button>
			<span class="flex-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Scratch</span>
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
						class="cursor-pointer opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 hover:text-destructive focus:opacity-100"
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
		<div class="flex items-center gap-2 border-b px-3 py-2">
			<span class="min-w-0 truncate font-mono text-sm">{active.name}</span>
			<div class="flex-1"></div>
			<Select.Root type="single" bind:value={picked} onValueChange={(v) => setLanguage(v as Language)}>
				<Select.Trigger class="h-8 w-28 shrink-0" aria-label="Language">{LANGUAGE_LABELS[picked]}</Select.Trigger>
				<Select.Content>
					{#each LANGUAGES as l (l)}
						<Select.Item value={l}>{LANGUAGE_LABELS[l]}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
			<Button size="icon" variant="ghost" class="shrink-0" aria-label="Download {active.name}" title="Download {active.name}" onclick={download}>
				<Download class="size-4" />
			</Button>
			<Button size="icon" class="shrink-0" onclick={run} disabled={running} aria-label={running ? 'Running' : 'Run'} title="Run (Cmd/Ctrl+Enter)">
				{#if running}<LoaderCircle class="size-4 animate-spin" />{:else}<Play class="size-4" />{/if}
			</Button>
		</div>
		<div class="grid min-h-0 flex-1 grid-rows-[minmax(16rem,1fr)_minmax(10rem,40%)] xl:grid-cols-[1fr_24rem] xl:grid-rows-1">
			<CodeEditor
				bind:value={active.content}
				path="{rootOf(active)}/{active.name}"
				language={MONACO_LANGUAGE[active.language]}
				tabSize={INDENT[active.language].tabSize}
				insertSpaces={INDENT[active.language].insertSpaces}
				onRun={run}
				onCursor={(c) => (cursor = c)}
				onReady={onEditorReady}
				class="h-full"
			/>
			<div class="flex min-h-0 flex-col border-t xl:border-t-0 xl:border-l">
				<div class="flex shrink-0 gap-1 border-b px-1.5">
					{#each [['output', 'Output', SquareChevronRight], ['problems', 'Problems', CircleAlert]] as const as [key, label, Icon] (key)}
						<button
							type="button"
							class={['flex cursor-pointer items-center gap-1 border-b-2 px-1.5 py-1.5', rightTab === key ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground']}
							aria-label={key === 'problems' ? `${label} (${problems.length})` : label}
							aria-pressed={rightTab === key}
							title={label}
							onclick={() => (rightTab = key)}
						>
							<Icon class="size-4" />
							{#if key === 'problems' && problems.length}<span class="rounded-full bg-muted px-1.5 text-[10px] leading-4">{problems.length}</span>{/if}
						</button>
					{/each}
				</div>
				<div class="min-h-0 flex-1">
					{#if rightTab === 'output'}
						<RunOutput {result} {running} />
					{:else if problems.length === 0}
						<p class="px-3 py-2 text-xs text-muted-foreground">No problems in {active.name}.</p>
					{:else}
						<div class="h-full overflow-auto py-1">
							{#each problems as d, i (`${d.line}:${d.column}:${i}`)}
								<div class="flex items-start gap-2 px-3 py-0.5 text-xs">
									{#if d.severity === 'error'}
										<CircleX class="mt-0.5 size-3.5 shrink-0 text-red-600 dark:text-red-400" />
									{:else if d.severity === 'warning'}
										<TriangleAlert class="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
									{:else}
										<Info class="mt-0.5 size-3.5 shrink-0 text-sky-600 dark:text-sky-400" />
									{/if}
									<span class="min-w-0 flex-1">{d.message}</span>
									<span class="shrink-0 text-muted-foreground">{d.source} [Ln {d.line}, Col {d.column}]</span>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>
<StatusBar
	target="Scratch (one-shot microVM)"
	errors={errorCount}
	warnings={warningCount}
	busy={running ? 'Running' : null}
	checking={false}
	line={cursor.line}
	column={cursor.column}
	tabSize={INDENT[active.language].tabSize}
	insertSpaces={INDENT[active.language].insertSpaces}
	language={LANGUAGE_LABELS[active.language]}
	onProblems={() => (rightTab = 'problems')}
/>
</div>
