import type { Diagnostic, Language } from './types';

/**
 * Compiler and checker output to Diagnostics, the same for a project's
 * checker (run in its box) and for a Scratch run's stderr.
 */

/** Where a box keeps the project, and run_sandbox the program: stripped from reported paths. */
const PREFIXES = ['/workspace/', '/tmp/sandbox/', './'];

export function relativePath(path: string): string {
	for (const prefix of PREFIXES) if (path.startsWith(prefix)) return path.slice(prefix.length);
	return path;
}

function severityOf(word: string | undefined): Diagnostic['severity'] {
	if (!word || /error/.test(word)) return 'error';
	return word === 'warning' ? 'warning' : 'info';
}

/**
 * `file:line[:col]: [severity[code]:] message`: gcc and g++, go (gofmt -e, go
 * vet), cargo --message-format=short, and ruby -wc.
 */
const COMPILER_LINE =
	/^(?<path>[^\s:][^:]*):(?<line>\d+):(?:(?<col>\d+):)?\s*(?:(?<sev>fatal error|error|warning|note)(?:\[(?<code>[^\]]+)\])?:\s*)?(?<msg>.+)$/;

/** bash -n: `main.sh: line 3: syntax error near unexpected token`. */
const BASH_LINE = /^(?<path>[^:]+): line (?<line>\d+): (?<msg>.+)$/;

/** A Python traceback's frame line, and the exception at its end. */
const PY_FRAME = /^\s*File "(?<path>[^"]+)", line (?<line>\d+)/;
const PY_ERROR = /^(?<type>[A-Za-z_][\w.]*(?:Error|Exception|Warning|Exit)): ?(?<msg>.*)$/;

/** node --check and an uncaught error: `/path/file.js:3` ... `SyntaxError: message`. */
const NODE_AT = /^(?<path>\/\S+\.(?:m|c)?js):(?<line>\d+)$/;
const NODE_ERROR = /^(?<type>\w*Error): (?<msg>.+)$/;

const SOURCE: Record<Language, string> = {
	python: 'python',
	node: 'node',
	bash: 'bash',
	ruby: 'ruby',
	go: 'go',
	rust: 'cargo',
	c: 'gcc',
	cpp: 'g++'
};

/** Parse what a checker or a failed run printed for `language`. */
export function parseDiagnostics(language: Language, output: string): Diagnostic[] {
	const source = SOURCE[language];
	const lines = output.split('\n');
	const found: Diagnostic[] = [];

	if (language === 'python') {
		// The checker prints JSON lines; a run prints a traceback.
		for (const line of lines) {
			if (!line.startsWith('{')) continue;
			try {
				const d = JSON.parse(line) as { path: string; line: number; column: number; message: string };
				found.push({ path: relativePath(d.path), line: d.line, column: d.column, severity: 'error', message: d.message, source });
			} catch {
				// not one of the checker's lines
			}
		}
		if (found.length) return found;
		let frame: { path: string; line: number } | null = null;
		for (const line of lines) {
			const f = PY_FRAME.exec(line);
			if (f?.groups) frame = { path: relativePath(f.groups.path), line: Number(f.groups.line) };
			const e = PY_ERROR.exec(line);
			if (e?.groups && frame) {
				found.push({ ...frame, column: 1, severity: 'error', message: `${e.groups.type}: ${e.groups.msg}`, source });
				frame = null;
			}
		}
		return found;
	}

	if (language === 'node') {
		let at: { path: string; line: number } | null = null;
		for (const line of lines) {
			const a = NODE_AT.exec(line);
			if (a?.groups) at = { path: relativePath(a.groups.path), line: Number(a.groups.line) };
			const e = NODE_ERROR.exec(line);
			if (e?.groups && at) {
				found.push({ ...at, column: 1, severity: 'error', message: `${e.groups.type}: ${e.groups.msg}`, source });
				at = null;
			}
		}
		return found;
	}

	const pattern = language === 'bash' ? BASH_LINE : COMPILER_LINE;
	for (const line of lines) {
		const m = pattern.exec(line.trimEnd());
		if (!m?.groups) continue;
		const { path, line: lineNo, col, sev, code, msg } = m.groups;
		// gcc's "In function 'main':" lines and its notes (which explain the error before them),
		// and bash quoting the offending line after the error, add nothing to the list.
		if (/^In (function|member function|file included)/.test(msg) || sev === 'note') continue;
		if (language === 'bash' && /^`.*'$/.test(msg)) continue;
		found.push({
			path: relativePath(path),
			line: Number(lineNo),
			column: col ? Number(col) : 1,
			severity: severityOf(sev),
			message: code ? `${msg} [${code}]` : msg,
			source
		});
	}
	return found;
}
