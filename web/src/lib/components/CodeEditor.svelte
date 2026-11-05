<script lang="ts">
	import { mode } from 'mode-watcher';
	import { onMount } from 'svelte';
	import type * as Monaco from 'monaco-editor';
	import { loadMonaco, modelFor } from '$lib/monaco';

	/**
	 * A Monaco editor (the editor in VS Code), loaded on first use so pages that
	 * don't edit code don't download it. Follows the light or dark theme.
	 *
	 * With `path`, each file gets its own model (kept while the page lives, with
	 * its undo history), and JavaScript files see each other, so the TypeScript
	 * worker resolves imports between them.
	 */

	interface Props {
		value: string;
		language: string;
		/** The file's model path, e.g. `workspace/src/app.js`. Without it the editor has one model of its own. */
		path?: string;
		tabSize?: number;
		insertSpaces?: boolean;
		/** Cmd/Ctrl+Enter. */
		onRun?: () => void;
		/** Cmd/Ctrl+S. */
		onSave?: () => void;
		onCursor?: (position: { line: number; column: number }) => void;
		/** Once Monaco and the editor are up: for markers, jumping to a line, and the like. */
		onReady?: (monaco: typeof Monaco, editor: Monaco.editor.IStandaloneCodeEditor) => void;
		class?: string;
		ariaLabel?: string;
	}

	let {
		value = $bindable(),
		language,
		path,
		tabSize = 4,
		insertSpaces = true,
		onRun,
		onSave,
		onCursor,
		onReady,
		class: className = '',
		ariaLabel = 'Code editor'
	}: Props = $props();

	let host: HTMLDivElement;
	let editor: Monaco.editor.IStandaloneCodeEditor | null = null;
	let monaco: typeof Monaco | null = null;
	let ready = $state(false);

	onMount(() => {
		let disposed = false;
		(async () => {
			const m = await loadMonaco();
			if (disposed) return;
			monaco = m;
			editor = m.editor.create(host, {
				model: path ? modelFor(m, path, value, language) : undefined,
				value: path ? undefined : value,
				language: path ? undefined : language,
				theme: mode.current === 'dark' ? 'vs-dark' : 'vs',
				automaticLayout: true,
				minimap: { enabled: false },
				fontSize: 13,
				scrollBeyondLastLine: false,
				padding: { top: 12 },
				fixedOverflowWidgets: true,
				ariaLabel
			});
			editor.onDidChangeModelContent(() => {
				const next = editor!.getValue();
				if (next !== value) value = next;
			});
			editor.onDidChangeCursorPosition((e) => onCursor?.({ line: e.position.lineNumber, column: e.position.column }));
			editor.addCommand(m.KeyMod.CtrlCmd | m.KeyCode.Enter, () => onRun?.());
			editor.addCommand(m.KeyMod.CtrlCmd | m.KeyCode.KeyS, () => onSave?.());
			ready = true;
			onReady?.(m, editor);
		})();
		return () => {
			disposed = true;
			// Models with a path outlive the editor (another tab may show them again); its own model goes with it.
			if (!path) editor?.getModel()?.dispose();
			editor?.dispose();
		};
	});

	// Another file: its model, made from `value` the first time it is opened.
	$effect(() => {
		const p = path;
		if (!ready || !editor || !monaco || !p) return;
		const model = modelFor(monaco, p, value, language);
		if (editor.getModel() !== model) {
			editor.setModel(model);
			const pos = editor.getPosition();
			if (pos) onCursor?.({ line: pos.lineNumber, column: pos.column });
		}
	});

	// Outside changes (a file switch, a starter, a reload from the box) reach the editor.
	$effect(() => {
		const v = value;
		const model = ready ? editor?.getModel() : null;
		if (model && model.getValue() !== v) model.setValue(v);
	});

	$effect(() => {
		const l = language;
		const model = ready ? editor?.getModel() : null;
		if (model && monaco && model.getLanguageId() !== l) monaco.editor.setModelLanguage(model, l);
	});

	$effect(() => {
		const options = { tabSize, insertSpaces };
		if (ready) editor?.getModel()?.updateOptions(options);
	});

	$effect(() => {
		const dark = mode.current === 'dark';
		if (ready && monaco) monaco.editor.setTheme(dark ? 'vs-dark' : 'vs');
	});
</script>

<div class={['relative min-h-0', className]}>
	<div bind:this={host} class="absolute inset-0"></div>
	{#if !ready}
		<p class="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">Loading the editor...</p>
	{/if}
</div>
