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

/**
 * The checker's options when a project has no tsconfig.json, and what one
 * adds to. Numbers are TypeScript's own enum values (the worker bundles 5.9;
 * Monaco's typings list only older ones): ESNext target and module, Node10
 * resolution.
 */
const BASE_OPTIONS = {
	allowJs: true,
	checkJs: true,
	allowNonTsExtensions: true,
	target: 99,
	module: 99,
	moduleResolution: 2,
	noEmit: true
};

/** tsconfig.json values the browser's TypeScript takes, lowercased, to their enum numbers. */
const ENUM_OPTIONS: Record<string, Record<string, number>> = {
	target: { es3: 0, es5: 1, es6: 2, es2015: 2, es2016: 3, es2017: 4, es2018: 5, es2019: 6, es2020: 7, es2021: 8, es2022: 9, es2023: 10, es2024: 11, esnext: 99 },
	module: { none: 0, commonjs: 1, amd: 2, umd: 3, system: 4, es6: 5, es2015: 5, es2020: 6, es2022: 7, esnext: 99, preserve: 200 },
	moduleResolution: { classic: 1, node: 2, node10: 2, bundler: 100 },
	jsx: { preserve: 1, react: 2, 'react-native': 3, 'react-jsx': 4, 'react-jsxdev': 5 },
	moduleDetection: { legacy: 1, auto: 2, force: 3 }
};

/**
 * Node's module modes (node16 to nodenext) decide ESM or CommonJS per file
 * from package.json, which the browser does not have: they are checked as
 * ESNext with bundler resolution, which takes the same import paths
 * (including .ts ones with allowImportingTsExtensions).
 */
const NODE_MODULES = new Set(['node16', 'node18', 'node20', 'nodenext']);

/** JSON with comments and trailing commas, as tsconfig.json is written. */
export function parseJsonc(text: string): unknown {
	let out = '';
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (c === '"') {
			const start = i;
			for (i++; i < text.length && text[i] !== '"'; i++) if (text[i] === '\\') i++;
			out += text.slice(start, i + 1);
		} else if (c === '/' && text[i + 1] === '/') {
			while (i < text.length && text[i] !== '\n') i++;
			out += '\n';
		} else if (c === '/' && text[i + 1] === '*') {
			const end = text.indexOf('*/', i + 2);
			i = end < 0 ? text.length : end + 1;
		} else {
			out += c;
		}
	}
	return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
}

/**
 * Check JavaScript and TypeScript with a project's tsconfig.json (or
 * jsconfig.json) on top of the base options, or with the base options alone
 * when `config` is null. Flags (strict, allowImportingTsExtensions,
 * verbatimModuleSyntax...), target, module, moduleResolution, jsx,
 * moduleDetection, baseUrl and paths are taken; lib, types and output
 * settings are not, since Node's types and the build live in the box.
 * Returns why the file could not be read, if it could not.
 */
export function setProjectCompilerOptions(m: typeof Monaco, config: string | null): string | null {
	const options: Record<string, unknown> = { ...BASE_OPTIONS };
	let problem: string | null = null;
	if (config !== null) {
		try {
			const parsed = parseJsonc(config) as { compilerOptions?: Record<string, unknown> } | null;
			// As with tsc, JavaScript is type checked only when the config asks (its syntax still is).
			options.checkJs = false;
			for (const [key, value] of Object.entries(parsed?.compilerOptions ?? {})) {
				if (typeof value === 'boolean') options[key] = value;
				else if (key === 'baseUrl' && typeof value === 'string') options[key] = value;
				else if (key === 'paths' && value && typeof value === 'object') options[key] = value;
				else if (key in ENUM_OPTIONS && typeof value === 'string') {
					const v = value.toLowerCase();
					if ((key === 'module' || key === 'moduleResolution') && NODE_MODULES.has(v)) {
						options.module = 99;
						options.moduleResolution = 100;
					} else if (v in ENUM_OPTIONS[key]) options[key] = ENUM_OPTIONS[key][v];
				}
			}
			// Bundler resolution only goes with an ES module setting.
			if (options.moduleResolution === 100 && ![99, 6, 7, 200].includes(options.module as number)) options.module = 99;
			// The checker never emits, whatever the project builds.
			options.noEmit = true;
		} catch (err) {
			problem = err instanceof Error ? err.message : String(err);
		}
	}
	for (const defaults of [m.typescript.javascriptDefaults, m.typescript.typescriptDefaults]) {
		defaults.setCompilerOptions(problem ? BASE_OPTIONS : (options as Monaco.typescript.CompilerOptions));
	}
	return problem;
}

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
		for (const defaults of [m.typescript.javascriptDefaults, m.typescript.typescriptDefaults]) {
			defaults.setCompilerOptions(BASE_OPTIONS);
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
