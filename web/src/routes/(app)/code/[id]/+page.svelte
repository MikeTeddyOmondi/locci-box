<script lang="ts">
	import { ArrowLeft, Play } from '@lucide/svelte';
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
		copyPath,
		createPath,
		deletePath,
		getDir,
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

	/** The Explorer starts collapsed; opening or closing it is remembered in this browser. */
	const TREE_KEY = 'locci-box.code.explorer';
	let showTree = $state(false);
	/** Wide enough for the Explorer beside the editor (md); on a phone it lies over it. */
	const wide = () => window.matchMedia('(min-width: 768px)').matches;

	function setTree(open: boolean) {
		showTree = open;
		try {
			localStorage.setItem(TREE_KEY, open ? 'open' : 'closed');
		} catch {
			// storage blocked: the choice lasts until reload
		}
	}
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

	/** Folders the box listing leaves closed (build, target, node_modules...), loaded because they were opened. */
	const SKIPPED = ['node_modules', 'target', '.venv', '__pycache__', 'build'];
	const loadedDirs = new Set<string>();

	/** The tree, plus one level of every skipped folder that is open (one that is gone is forgotten). */
	async function refreshTree() {
		const [base, ...dirs] = await Promise.all([
			getTree(id),
			...[...loadedDirs].map((path) => getDir({ id, path }).catch(() => [] as string[]))
		]);
		[...loadedDirs].forEach((path, i) => {
			if (dirs[i].length === 0 && !base.includes(`${path}/`)) loadedDirs.delete(path);
		});
		entries = [...new Set([...base, ...dirs.flat()])].sort((a, b) => a.localeCompare(b));
	}

	async function expandDir(path: string) {
		if (loadedDirs.has(path) || !path.split('/').some((part) => SKIPPED.includes(part))) return;
		loadedDirs.add(path);
		try {
			const listed = await getDir({ id, path });
			entries = [...new Set([...entries, ...listed])].sort((a, b) => a.localeCompare(b));
		} catch (err) {
			loadedDirs.delete(path);
			toast.error(errMessage(err, `${path} could not be listed`));
		}
	}

	/**
	 * Commands in the terminal change files (make, npm install, cargo build):
	 * the tree follows once the terminal has been quiet for a moment.
	 */
	let syncTimer: ReturnType<typeof setTimeout> | undefined;
	function terminalActivity() {
		clearTimeout(syncTimer);
		syncTimer = setTimeout(() => {
			void refreshTree().catch(() => {});
			void reloadOpenFiles();
		}, 1500);
	}

	/**
	 * Open files a command rewrote (a formatter such as gofmt -w or prettier
	 * --write, a linter's --fix) show the new text. A tab with unsaved edits is
	 * left alone, so typing is never lost; its next save writes over the change.
	 */
	async function reloadOpenFiles() {
		await Promise.all(
			tabs
				.filter((t) => t.loaded && !t.note && t.content === t.saved)
				.map(async (tab) => {
					const file = await readProjectFile({ id, path: tab.path }).catch(() => null);
					if (!file || file.content === null || file.truncated) return;
					// Still unedited, and the box has something else: take it.
					if (tab.content === tab.saved && file.content !== tab.saved) tab.content = tab.saved = file.content;
				})
		);
	}

	onMount(() => {
		try {
			// A phone always starts on the editor; a wider screen as it was left.
			showTree = wide() && localStorage.getItem(TREE_KEY) === 'open';
			if (!wide()) panelHeight = Math.round(window.innerHeight * 0.35);
		} catch {
			// storage blocked: collapsed
		}
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
			clearTimeout(syncTimer);
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

	async function copy(from: string, to: string) {
		await saveAll();
		try {
			await copyPath({ id, from, to });
		} catch (err) {
			return toast.error(errMessage(err, `${from} could not be copied`));
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
		<Button
			size="icon"
			variant="ghost"
			aria-label="Toggle the Explorer"
			aria-pressed={showTree}
			title="{showTree ? 'Hide' : 'Show'} the Explorer"
			onclick={() => setTree(!showTree)}
		>
			<!-- lucide's panel-left, with the sidebar filled in while it is open, like the panel toggle -->
			<svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<rect width="18" height="18" x="3" y="3" rx="2" />
				<path d="M9 3v18" />
				{#if showTree}<path d="M9 3v18H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" fill="currentColor" />{/if}
			</svg>
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
			<button
				type="button"
				class="min-w-0 cursor-pointer truncate text-sm font-medium"
				title="Double-click to rename"
				ondblclick={() => (renamingProject = true)}
			>
				{project?.name ?? 'Project'}
			</button>
		{/if}
		<span class="hidden shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground sm:inline">{LANGUAGE_LABELS[language]}</span>
		<div class="flex-1"></div>
		<span class="hidden font-mono text-xs text-muted-foreground md:inline">{RUN_COMMAND[language]}</span>
		<Button
			size="icon"
			class="shrink-0"
			onclick={run}
			disabled={!!busy}
			aria-label="Run"
			title="Run {RUN_COMMAND[language]} in the terminal (Cmd/Ctrl+Enter)"
		>
			<Play class="size-4" />
		</Button>
		<Button
			size="icon"
			variant="ghost"
			aria-label="Toggle the panel"
			aria-pressed={panelOpen}
			title="{panelOpen ? 'Hide' : 'Show'} the panel (Cmd/Ctrl+J)"
			onclick={() => (panelOpen = !panelOpen)}
		>
			<!-- lucide's panel-bottom, with the panel filled in while it is open (as VS Code's layout toggle) -->
			<svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<rect width="18" height="18" x="3" y="3" rx="2" />
				<path d="M3 15h18" />
				{#if panelOpen}<path d="M3 15h18v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="currentColor" />{/if}
			</svg>
		</Button>
	</div>

	<div class="relative flex min-h-0 flex-1">
		{#if showTree}
			<!-- On a phone the Explorer lies over the editor; a tap beside it, or opening a file, closes it. -->
			<button type="button" class="absolute inset-0 z-20 bg-black/40 md:hidden" aria-label="Close the Explorer" onclick={() => setTree(false)}></button>
			<aside
				class="absolute inset-y-0 left-0 z-30 flex w-72 max-w-[85%] flex-col border-r bg-background shadow-xl md:static md:z-auto md:w-56 md:max-w-none md:shrink-0 md:shadow-none lg:w-64"
			>
				<FileTree
					title={project?.name ?? 'Explorer'}
					{entries}
					{activePath}
					problems={problemsByFile}
					onOpen={(path) => {
						if (!wide()) setTree(false);
						void openFile(path);
					}}
					onCreate={create}
					onRename={rename}
					onCopy={copy}
					onDelete={remove}
					onRefresh={refreshTree}
					onExpand={expandDir}
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
					class="absolute inset-x-0 -top-1 z-10 h-2 cursor-row-resize touch-none"
					role="separator"
					aria-orientation="horizontal"
					aria-label="Resize the panel"
					onpointerdown={resizePanel}
				></div>
				<BottomPanel bind:this={panel} boxId={id} {problems} bind:tab={panelTab} onJump={jump} onHide={() => (panelOpen = false)} onActivity={terminalActivity} />
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
