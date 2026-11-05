<script lang="ts">
	import { ArrowLeft, FolderTree, PanelBottom, Play } from '@lucide/svelte';
	import { onMount, tick } from 'svelte';
	import { toast } from 'svelte-sonner';
	import type * as Monaco from 'monaco-editor';
	import { page } from '$app/state';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import BottomPanel from '$lib/components/ide/BottomPanel.svelte';
	import EditorTabs from '$lib/components/ide/EditorTabs.svelte';
	import FileTree from '$lib/components/ide/FileTree.svelte';
	import StatusBar from '$lib/components/ide/StatusBar.svelte';
	import { Button } from '$lib/components/ui/button';
	import { confirmDialog } from '$lib/confirm.svelte';
	import { ENTRY_FILE, INDENT, languageOf, monacoLanguageOf, RUN_COMMAND } from '$lib/languages';
	import { disposeModels, loadMonaco, modelFor, setCheckerMarkers, workerDiagnostics } from '$lib/monaco';
	import { LANGUAGE_LABELS, type BoxInfo, type Diagnostic, type Language } from '$lib/types';
	import { errMessage } from '$lib/utils';
	import {
		checkProject,
		createPath,
		deletePath,
		getProject,
		getTree,
		readProjectFile,
		renamePath,
		renameProject,
		saveProjectFile
	} from '../../../projects.remote';

	/**
	 * A project in its box, laid out as VS Code: Explorer, editor tabs, the
	 * PROBLEMS and TERMINAL panel, and the status bar. Files save themselves
	 * shortly after typing stops; each save runs the language's checker in the
	 * box, and JavaScript is checked as you type by Monaco's TypeScript worker.
	 */

	const id = page.params.id!;
	/** Where this project's models live in Monaco (file:///box/<id>/...), apart from other projects'. */
	const ROOT = `box/${id}`;
	const SAVE_AFTER_MS = 800;

	interface Tab {
		path: string;
		content: string;
		saved: string;
		loaded: boolean;
		/** Not text (or too big to edit): shown as a note instead of the editor. */
		note: string | null;
	}

	let project = $state<BoxInfo | null>(null);
	let entries = $state<string[]>([]);
	let busy = $state<string | null>('Opening the project');
	let tabs = $state<Tab[]>([]);
	let activePath = $state<string | null>(null);
	const active = $derived(tabs.find((t) => t.path === activePath) ?? null);

	let checkerProblems = $state<Diagnostic[]>([]);
	let workerProblems = $state<Diagnostic[]>([]);
	let checking = $state(false);
	let cursor = $state({ line: 1, column: 1 });

	let showTree = $state(true);
	let panelOpen = $state(true);
	/** Problems until the box is up; then the terminal opens (see onMount). */
	let panelTab = $state<'problems' | 'terminal'>('problems');
	let panelHeight = $state(260);
	let panel = $state<ReturnType<typeof BottomPanel>>();

	let monaco: typeof Monaco | null = null;
	let editor: Monaco.editor.IStandaloneCodeEditor | null = null;

	const language = $derived<Language>((project?.language as Language | null) ?? 'node');
	const fileLanguage = $derived(activePath ? (languageOf(activePath) ?? language) : language);
	const indent = $derived(INDENT[fileLanguage]);

	const problems = $derived(
		[...checkerProblems, ...workerProblems].sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line || a.column - b.column)
	);
	const problemsByFile = $derived.by(() => {
		const map = new Map<string, { errors: number; warnings: number }>();
		for (const p of problems) {
			const c = map.get(p.path) ?? { errors: 0, warnings: 0 };
			if (p.severity === 'error') c.errors++;
			else if (p.severity === 'warning') c.warnings++;
			map.set(p.path, c);
		}
		return map;
	});
	const errorCount = $derived(problems.filter((p) => p.severity === 'error').length);
	const warningCount = $derived(problems.filter((p) => p.severity === 'warning').length);

	async function refreshTree() {
		entries = await getTree(id);
	}

	onMount(() => {
		let markerListener: Monaco.IDisposable | undefined;
		let gone = false;
		(async () => {
			try {
				project = await getProject(id);
				const m = await loadMonaco();
				if (gone) return;
				monaco = m;
				markerListener = m.editor.onDidChangeMarkers(() => (workerProblems = workerDiagnostics(m, ROOT)));
				busy = project.status === 'running' ? 'Loading the project' : 'Starting the box';
				await refreshTree();
				busy = null;
				// Listing the tree started a stopped box; now the terminal can attach to it.
				project = await getProject(id);
				panelTab = 'terminal';
				const entry = ENTRY_FILE[language];
				const first = entries.includes(entry) ? entry : entries.find((e) => !e.endsWith('/'));
				if (first) await openFile(first);
				if (language === 'node') await preloadScripts();
				void check();
			} catch (err) {
				busy = null;
				toast.error(errMessage(err, 'The project could not be opened'));
			}
		})();

		const onKey = (e: KeyboardEvent) => {
			if (!(e.metaKey || e.ctrlKey)) return;
			if (e.key === 'j') {
				e.preventDefault();
				panelOpen = !panelOpen;
			} else if (e.key === 's') {
				e.preventDefault();
				void saveAll();
			}
		};
		window.addEventListener('keydown', onKey);
		return () => {
			gone = true;
			window.removeEventListener('keydown', onKey);
			markerListener?.dispose();
			// This project's models go with the page; another project starts clean.
			if (monaco) for (const model of monaco.editor.getModels()) if (model.uri.path.startsWith(`/${ROOT}/`)) model.dispose();
		};
	});

	/**
	 * JavaScript files the TypeScript worker should know before they are opened,
	 * so an import of one is checked against what it exports.
	 */
	async function preloadScripts() {
		const scripts = entries.filter((e) => /\.(m|c)?[jt]s$/.test(e) && !e.startsWith('node_modules/')).slice(0, 40);
		await Promise.all(
			scripts.map(async (path) => {
				if (!monaco || monaco.editor.getModel(monaco.Uri.file(`/${ROOT}/${path}`))) return;
				const file = await readProjectFile({ id, path }).catch(() => null);
				if (file?.content != null && monaco) modelFor(monaco, `${ROOT}/${path}`, file.content, monacoLanguageOf(path));
			})
		);
	}

	async function openFile(path: string) {
		if (tabs.some((t) => t.path === path)) {
			activePath = path;
			return;
		}
		tabs.push({ path, content: '', saved: '', loaded: false, note: null });
		activePath = path;
		const tab = tabs.find((t) => t.path === path)!;
		try {
			const file = await readProjectFile({ id, path });
			if (file.content === null) tab.note = `${path} is a binary file (${file.size} bytes).`;
			else if (file.truncated) tab.note = `${path} is over 1 MB; open it in the terminal instead.`;
			else tab.content = tab.saved = file.content;
		} catch (err) {
			tab.note = errMessage(err, `${path} could not be read`);
		}
		tab.loaded = true;
	}

	async function save(path: string) {
		const tab = tabs.find((t) => t.path === path);
		if (!tab || tab.note || tab.content === tab.saved) return;
		const content = tab.content;
		try {
			await saveProjectFile({ id, path, content });
			tab.saved = content;
			void check();
		} catch (err) {
			toast.error(errMessage(err, `${path} could not be saved`));
		}
	}

	async function saveAll() {
		await Promise.all(tabs.filter((t) => t.content !== t.saved).map((t) => save(t.path)));
	}

	// Saved shortly after typing stops, as VS Code's auto save.
	$effect(() => {
		const tab = active;
		if (!tab?.loaded || tab.note) return;
		if (tab.content === tab.saved) return;
		const path = tab.path;
		const timer = setTimeout(() => save(path), SAVE_AFTER_MS);
		return () => clearTimeout(timer);
	});

	let checkSeq = 0;
	/** Run the language's checker in the box; the latest check wins. */
	async function check() {
		// JavaScript has no checker in the box: the TypeScript worker checks it as you type.
		if (!project || language === 'node') return;
		const mine = ++checkSeq;
		checking = true;
		try {
			const r = await checkProject({ id, language });
			if (mine !== checkSeq || !r.checked) return;
			checkerProblems = r.diagnostics;
			if (monaco) setCheckerMarkers(monaco, ROOT, checkerProblems);
		} catch {
			// a check is a nicety: a failure leaves the last result
		} finally {
			if (mine === checkSeq) checking = false;
		}
	}

	// A file opened after a check gets its markers too.
	$effect(() => {
		void activePath;
		void active?.loaded;
		const list = checkerProblems;
		if (monaco) tick().then(() => monaco && setCheckerMarkers(monaco, ROOT, list));
	});

	async function closeTab(path: string) {
		await save(path);
		const i = tabs.findIndex((t) => t.path === path);
		if (i < 0) return;
		tabs.splice(i, 1);
		if (activePath === path) activePath = tabs.at(Math.max(0, i - 1))?.path ?? null;
	}

	async function jump(d: Diagnostic) {
		if (!entries.includes(d.path)) return toast.error(`${d.path} is not in the project`);
		await openFile(d.path);
		await tick();
		await tick();
		if (!editor) return;
		editor.setPosition({ lineNumber: d.line, column: d.column });
		editor.revealLineInCenter(d.line);
		editor.focus();
	}

	async function create(path: string, folder: boolean) {
		try {
			await createPath({ id, path, folder });
			await refreshTree();
			if (!folder) await openFile(path);
		} catch (err) {
			toast.error(errMessage(err, `${path} could not be created`));
		}
	}

	async function rename(from: string, to: string) {
		await saveAll();
		try {
			await renamePath({ id, from, to });
		} catch (err) {
			return toast.error(errMessage(err, `${from} could not be renamed`));
		}
		if (monaco) disposeModels(monaco, ROOT, from);
		for (const tab of tabs) {
			if (tab.path === from || tab.path.startsWith(`${from}/`)) {
				const moved = to + tab.path.slice(from.length);
				if (activePath === tab.path) activePath = moved;
				tab.path = moved;
			}
		}
		await refreshTree();
		void check();
	}

	async function remove(path: string, folder: boolean) {
		const ok = await confirmDialog({
			title: `Delete ${path}?`,
			description: folder ? 'The folder and everything in it are deleted from the box.' : 'The file is deleted from the box.',
			confirmLabel: 'Delete',
			destructive: true
		});
		if (!ok) return;
		try {
			await deletePath({ id, path });
		} catch (err) {
			return toast.error(errMessage(err, `${path} could not be deleted`));
		}
		tabs = tabs.filter((t) => t.path !== path && !t.path.startsWith(`${path}/`));
		if (activePath && !tabs.some((t) => t.path === activePath)) activePath = tabs.at(-1)?.path ?? null;
		if (monaco) disposeModels(monaco, ROOT, path);
		await refreshTree();
		void check();
	}

	async function run() {
		await saveAll();
		panelOpen = true;
		await tick();
		await panel?.run(RUN_COMMAND[language]);
	}

	let renamingProject = $state(false);
	async function commitProjectName(name: string) {
		renamingProject = false;
		const trimmed = name.trim();
		if (!project || !trimmed || trimmed === project.name) return;
		try {
			project = await renameProject({ id, name: trimmed });
		} catch (err) {
			toast.error(errMessage(err, 'The project could not be renamed'));
		}
	}

	/** Drag the panel's top edge to resize it. */
	function resizePanel(e: PointerEvent) {
		const startY = e.clientY;
		const startHeight = panelHeight;
		const move = (ev: PointerEvent) => {
			panelHeight = Math.min(Math.max(120, startHeight + startY - ev.clientY), window.innerHeight - 200);
		};
		const up = () => {
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerup', up);
		};
		window.addEventListener('pointermove', move);
		window.addEventListener('pointerup', up);
	}
</script>

<svelte:head><title>{project?.name ?? 'Project'} · Code · Locci Box</title></svelte:head>

<div class="flex min-h-0 flex-1 flex-col">
	<!-- Title bar -->
	<div class="flex shrink-0 items-center gap-2 border-b px-2 py-1.5">
		<Button size="icon" variant="ghost" href="/code" aria-label="All projects" title="All projects">
			<ArrowLeft class="size-4" />
		</Button>
		<Button size="icon" variant="ghost" aria-label="Toggle the Explorer" title="Explorer" onclick={() => (showTree = !showTree)}>
			<FolderTree class="size-4" />
		</Button>
		{#if renamingProject}
			<input
				class="w-48 rounded border bg-background px-1.5 py-0.5 text-sm"
				value={project?.name ?? ''}
				aria-label="Project name"
				{@attach (node: HTMLInputElement) => node.select()}
				onblur={(e) => commitProjectName(e.currentTarget.value)}
				onkeydown={(e) => {
					if (e.key === 'Enter') commitProjectName(e.currentTarget.value);
					if (e.key === 'Escape') renamingProject = false;
				}}
			/>
		{:else}
			<button type="button" class="cursor-pointer truncate text-sm font-medium" title="Double-click to rename" ondblclick={() => (renamingProject = true)}>
				{project?.name ?? 'Project'}
			</button>
		{/if}
		<span class="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{LANGUAGE_LABELS[language]}</span>
		<div class="flex-1"></div>
		<span class="hidden font-mono text-xs text-muted-foreground md:inline">{RUN_COMMAND[language]}</span>
		<Button size="sm" onclick={run} disabled={!!busy} title="Run {RUN_COMMAND[language]} in the terminal">
			<Play class="size-4" /> Run
		</Button>
		<Button
			size="icon"
			variant={panelOpen ? 'secondary' : 'ghost'}
			aria-label="Toggle the panel"
			title="Toggle the panel (Cmd/Ctrl+J)"
			onclick={() => (panelOpen = !panelOpen)}
		>
			<PanelBottom class="size-4" />
		</Button>
	</div>

	<div class="flex min-h-0 flex-1">
		{#if showTree}
			<aside class="flex w-56 shrink-0 flex-col border-r lg:w-64">
				<FileTree
					title={project?.name ?? 'Explorer'}
					{entries}
					{activePath}
					problems={problemsByFile}
					onOpen={openFile}
					onCreate={create}
					onRename={rename}
					onDelete={remove}
					onRefresh={refreshTree}
				/>
			</aside>
		{/if}

		<div class="flex min-h-0 min-w-0 flex-1 flex-col">
			<EditorTabs
				tabs={tabs.map((t) => ({ path: t.path, dirty: t.content !== t.saved, errors: problemsByFile.get(t.path)?.errors ?? 0 }))}
				active={activePath}
				onSelect={(p) => (activePath = p)}
				onClose={closeTab}
			/>
			<div class="relative min-h-0 flex-1">
				{#if busy}
					<p class="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">{busy}...</p>
				{:else if !active}
					<p class="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">Open a file from the Explorer.</p>
				{:else if !active.loaded}
					<p class="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">Opening {active.path}...</p>
				{:else if active.note}
					<p class="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-muted-foreground">{active.note}</p>
				{:else}
					<CodeEditor
						bind:value={active.content}
						path="{ROOT}/{active.path}"
						language={monacoLanguageOf(active.path)}
						tabSize={indent.tabSize}
						insertSpaces={indent.insertSpaces}
						onRun={run}
						onSave={() => active && save(active.path)}
						onCursor={(c) => (cursor = c)}
						onReady={(_, e) => {
							editor = e;
							e.focus();
						}}
						class="h-full"
						ariaLabel="Editor, {active.path}"
					/>
				{/if}
			</div>

			<!-- Kept mounted while hidden, so terminals keep their shells. -->
			<div class={['relative flex shrink-0 flex-col border-t', !panelOpen && 'hidden']} style="height: {panelHeight}px">
				<div
					class="absolute inset-x-0 -top-1 z-10 h-2 cursor-row-resize"
					role="separator"
					aria-orientation="horizontal"
					aria-label="Resize the panel"
					onpointerdown={resizePanel}
				></div>
				<BottomPanel bind:this={panel} boxId={id} {problems} bind:tab={panelTab} onJump={jump} onHide={() => (panelOpen = false)} />
			</div>
		</div>
	</div>

	<StatusBar
		target={project ? `${project.box_id} (${project.status})` : id}
		{busy}
		errors={errorCount}
		warnings={warningCount}
		{checking}
		line={cursor.line}
		column={cursor.column}
		tabSize={indent.tabSize}
		insertSpaces={indent.insertSpaces}
		language={activePath && !languageOf(activePath) ? monacoLanguageOf(activePath) : LANGUAGE_LABELS[fileLanguage]}
		onProblems={() => {
			panelOpen = true;
			panelTab = 'problems';
		}}
	/>
</div>
