<script lang="ts">
	import { mode } from 'mode-watcher';
	import { onMount } from 'svelte';
	import type * as Monaco from 'monaco-editor';

	/**
	 * A Monaco editor (the editor in VS Code), loaded on first use so pages that
	 * don't edit code don't download it. Follows the light or dark theme.
	 */

	interface Props {
		value: string;
		language: string;
		/** Cmd/Ctrl+Enter. */
		onRun?: () => void;
		class?: string;
		ariaLabel?: string;
	}

	let { value = $bindable(), language, onRun, class: className = '', ariaLabel = 'Code editor' }: Props = $props();

	let host: HTMLDivElement;
	let editor: Monaco.editor.IStandaloneCodeEditor | null = null;
	let monaco: typeof Monaco | null = null;
	let ready = $state(false);

	onMount(() => {
		let disposed = false;
		(async () => {
			const [m, { default: EditorWorker }] = await Promise.all([
				import('monaco-editor'),
				import('monaco-editor/editor/editor.worker?worker')
			]);
			if (disposed) return;
			// Syntax colouring needs only the base worker; language services are not used.
			self.MonacoEnvironment = { getWorker: () => new EditorWorker() };
			monaco = m;
			editor = m.editor.create(host, {
				value,
				language,
				theme: mode.current === 'dark' ? 'vs-dark' : 'vs',
				automaticLayout: true,
				minimap: { enabled: false },
				fontSize: 13,
				tabSize: 4,
				scrollBeyondLastLine: false,
				padding: { top: 12 },
				ariaLabel
			});
			editor.onDidChangeModelContent(() => {
				const next = editor!.getValue();
				if (next !== value) value = next;
			});
			editor.addCommand(m.KeyMod.CtrlCmd | m.KeyCode.Enter, () => onRun?.());
			ready = true;
		})();
		return () => {
			disposed = true;
			editor?.dispose();
		};
	});

	// Outside changes (a file switch, a starter) reach the editor.
	$effect(() => {
		const v = value;
		if (ready && editor && editor.getValue() !== v) editor.setValue(v);
	});

	$effect(() => {
		const l = language;
		const model = ready ? editor?.getModel() : null;
		if (model && monaco) monaco.editor.setModelLanguage(model, l);
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
