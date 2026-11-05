import type * as Monaco from 'monaco-editor';
import type { Diagnostic } from './types';

/** The owner of the markers a checker or a run reports (the TypeScript worker uses its own). */
export const CHECKER_OWNER = 'locci';

/**
 * JavaScript without the TypeScript worker. The Playground's code and tests
 * run as one program, but the worker would check each editor alone and report
 * the other's names as missing.
 */
export const PLAIN_JAVASCRIPT = 'javascript-plain';

/**
 * Monaco, loaded once on first use (pages that don't edit code never download
 * it), with two workers: the base one, and TypeScript's language service for
 * JavaScript and TypeScript files, which reports their errors as you type.
 */

let loading: Promise<typeof Monaco> | null = null;

/**
 * Errors the browser cannot judge, because node_modules and Node's own types
 * are in the box, not here: "Cannot find module" (2307, 2792), no types for a
 * module (7016), and Node globals such as require and process (2580, 2591).
 */
const IGNORED_CODES = [2307, 2792, 7016, 2580, 2591];

export function loadMonaco(): Promise<typeof Monaco> {
	loading ??= (async () => {
		const [m, { default: EditorWorker }, { default: TsWorker }, js] = await Promise.all([
			import('monaco-editor'),
			import('monaco-editor/editor/editor.worker?worker'),
			import('monaco-editor/language/typescript/ts.worker?worker'),
			import('monaco-editor/languages/definitions/javascript/javascript.js')
		]);
		// JavaScript coloured but not checked, for editors whose code is only part of a program.
		m.languages.register({ id: PLAIN_JAVASCRIPT });
		m.languages.setMonarchTokensProvider(PLAIN_JAVASCRIPT, js.language);
		m.languages.setLanguageConfiguration(PLAIN_JAVASCRIPT, js.conf);
		self.MonacoEnvironment = {
			getWorker: (_id, label) => (label === 'typescript' || label === 'javascript' ? new TsWorker() : new EditorWorker())
		};
		const options = {
			allowJs: true,
			checkJs: true,
			allowNonTsExtensions: true,
			target: m.typescript.ScriptTarget.ESNext,
			module: m.typescript.ModuleKind.ESNext,
			moduleResolution: m.typescript.ModuleResolutionKind.NodeJs,
			noEmit: true
		};
		for (const defaults of [m.typescript.javascriptDefaults, m.typescript.typescriptDefaults]) {
			defaults.setCompilerOptions(options);
			defaults.setDiagnosticsOptions({ noSemanticValidation: false, noSyntaxValidation: false, diagnosticCodesToIgnore: IGNORED_CODES });
			// Every open model is part of one program, so `import './lib/math.js'` resolves.
			defaults.setEagerModelSync(true);
		}
		return m;
	})();
	return loading;
}

/**
 * Put `diagnostics` (paths relative to `root`, e.g. "workspace") on every open
 * model under it, replacing the previous ones. Files not open keep theirs in
 * the list and get the markers when opened (call this again then).
 */
export function setCheckerMarkers(m: typeof Monaco, root: string, diagnostics: Diagnostic[]) {
	const prefix = `/${root}/`;
	for (const model of m.editor.getModels()) {
		if (!model.uri.path.startsWith(prefix)) continue;
		const path = model.uri.path.slice(prefix.length);
		const lines = model.getLineCount();
		m.editor.setModelMarkers(
			model,
			CHECKER_OWNER,
			diagnostics
				.filter((d) => d.path === path)
				.map((d) => {
					const line = Math.min(Math.max(1, d.line), lines);
					const column = Math.max(1, d.column);
					// Without an end, underline to the end of the word at the column (or the whole line).
					const word = model.getWordAtPosition({ lineNumber: line, column });
					return {
						severity:
							d.severity === 'error' ? m.MarkerSeverity.Error : d.severity === 'warning' ? m.MarkerSeverity.Warning : m.MarkerSeverity.Info,
						message: d.message,
						source: d.source,
						startLineNumber: line,
						startColumn: (d.endColumn ?? word) ? column : 1,
						endLineNumber: d.endLine ?? line,
						endColumn: d.endColumn ?? word?.endColumn ?? model.getLineMaxColumn(line)
					};
				})
		);
	}
}

/** What the TypeScript worker reports for the models under `root`, as Diagnostics. */
export function workerDiagnostics(m: typeof Monaco, root: string): Diagnostic[] {
	const prefix = `/${root}/`;
	return m.editor
		.getModelMarkers({})
		// Hints (the faint dots under code) stay out of Problems, as in VS Code.
		.filter((mk) => mk.owner !== CHECKER_OWNER && mk.severity !== m.MarkerSeverity.Hint && mk.resource.path.startsWith(prefix))
		.map((mk) => ({
			path: mk.resource.path.slice(prefix.length),
			line: mk.startLineNumber,
			column: mk.startColumn,
			endLine: mk.endLineNumber,
			endColumn: mk.endColumn,
			severity: mk.severity === m.MarkerSeverity.Error ? 'error' : mk.severity === m.MarkerSeverity.Warning ? 'warning' : 'info',
			message: mk.message,
			source: mk.source ?? 'ts'
		}));
}

/** Close the models under `root/path` (a file, or a folder and everything in it). */
export function disposeModels(m: typeof Monaco, root: string, path: string) {
	const file = `/${root}/${path}`;
	for (const model of m.editor.getModels()) {
		if (model.uri.path === file || model.uri.path.startsWith(`${file}/`)) model.dispose();
	}
}

/** The model for `path` (a file:// URI path such as `workspace/src/app.js`), made with `value` the first time. */
export function modelFor(m: typeof Monaco, path: string, value: string, language: string): Monaco.editor.ITextModel {
	const uri = m.Uri.file(`/${path}`);
	const existing = m.editor.getModel(uri);
	if (existing) {
		if (existing.getLanguageId() !== language) m.editor.setModelLanguage(existing, language);
		return existing;
	}
	return m.editor.createModel(value, language, uri);
}
