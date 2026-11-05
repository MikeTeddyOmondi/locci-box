import type { Language } from '$lib/types';

/**
 * Code projects: what a new project's box gets (files plus an init command,
 * as `npm init` or `cargo init` would leave it) and how each language is
 * checked for errors in the box after a save.
 */

/** Folders the file tree shows but does not open, and the checkers skip. */
export const SKIPPED_DIRS = ['node_modules', 'target', '.git', '.venv', '__pycache__', 'build'];

/** `find` arguments that print SKIPPED_DIRS as folders without going into them. */
const PRUNE = `\\( ${SKIPPED_DIRS.map((d) => `-name '${d}'`).join(' -o ')} \\) -prune`;

/** A shell word for `value` (single quotes, with any quote in it escaped). */
export function sq(value: string): string {
	return `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * A path inside /workspace, as the console sends it: relative, no `..`, no
 * empty parts. Anything else is refused before it reaches a shell.
 */
export function workspacePath(path: string): string | null {
	const trimmed = path.trim().replace(/\/+$/, '');
	if (!trimmed || trimmed.startsWith('/') || trimmed.includes('\0')) return null;
	const parts = trimmed.split('/');
	if (parts.some((p) => p === '' || p === '.' || p === '..')) return null;
	return trimmed;
}

/**
 * The project tree: folders end in "/"; skipped folders are listed but not
 * entered, except .git, which is hidden as in VS Code. At most 2000 entries.
 */
export const TREE_COMMAND = `find . -mindepth 1 -name '.git' -prune -o ${PRUNE} -printf '%P/\\n' -o -type d -printf '%P/\\n' -o -printf '%P\\n' | head -n 2000`;

/** A name usable as a package or crate name: lowercase letters, digits, - and _. */
function slug(name: string): string {
	const s = name
		.toLowerCase()
		.replace(/[^a-z0-9_-]+/g, '-')
		.replace(/^[-_]+|[-_]+$/g, '');
	return /^[a-z]/.test(s) ? s : `app-${s || 'project'}`;
}

interface Template {
	files: Record<string, string>;
	/** Run in /workspace after the files are written. */
	init?: string;
}

const GITIGNORE: Partial<Record<Language, string>> = {
	node: 'node_modules/\n',
	python: '__pycache__/\n.venv/\n',
	rust: 'target/\n',
	c: 'build/\n',
	cpp: 'build/\n'
};

function makefile(compiler: string, ext: string, flags: string): string {
	return `CC := ${compiler}
CFLAGS := ${flags} -Wall -Wextra -Isrc
SRC := $(wildcard src/*.${ext})
BIN := build/main

$(BIN): $(SRC) $(wildcard src/*.h)
\tmkdir -p build
\t$(CC) $(CFLAGS) $(SRC) -o $(BIN)

.PHONY: run clean
run: $(BIN)
\t./$(BIN)

clean:
\trm -rf build
`;
}

/** A new project for `language`: two files that import each other, so modules work from the start. */
export function template(language: Language, name: string): Template {
	const pkg = slug(name);
	const t = ((): Template => {
		switch (language) {
			case 'node':
				return {
					init: `npm init -y >/dev/null && npm pkg set name=${sq(pkg)} type=module scripts.start='node index.js'`,
					files: {
						'index.js': `import { fibonacci } from './lib/math.js';

for (let i = 0; i < 10; i++) {
  console.log(\`fib(\${i}) = \${fibonacci(i)}\`);
}
`,
						'lib/math.js': `/** The nth Fibonacci number. */
export function fibonacci(n) {
  let [a, b] = [0, 1];
  for (let i = 0; i < n; i++) [a, b] = [b, a + b];
  return a;
}
`
					}
				};
			case 'python':
				return {
					files: {
						'main.py': `from mathutils import fibonacci

for i in range(10):
    print(f"fib({i}) = {fibonacci(i)}")
`,
						'mathutils.py': `def fibonacci(n: int) -> int:
    """The nth Fibonacci number."""
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a
`,
						'requirements.txt': ''
					}
				};
			case 'go':
				return {
					init: `go mod init ${sq(pkg)} >/dev/null 2>&1`,
					files: {
						'main.go': `package main

import "fmt"

func main() {
	for i := 0; i < 10; i++ {
		fmt.Printf("fib(%d) = %d\\n", i, fibonacci(i))
	}
}
`,
						'fib.go': `package main

// fibonacci returns the nth Fibonacci number.
func fibonacci(n int) int {
	a, b := 0, 1
	for i := 0; i < n; i++ {
		a, b = b, a+b
	}
	return a
}
`
					}
				};
			case 'rust':
				return {
					// cargo init writes Cargo.toml and src/main.rs; ours replaces main.rs after it.
					init: `cargo init --vcs none --name ${sq(pkg.replace(/-/g, '_'))} >/dev/null 2>&1`,
					files: {
						'src/main.rs': `mod math;

fn main() {
    for i in 0..10 {
        println!("fib({i}) = {}", math::fibonacci(i));
    }
}
`,
						'src/math.rs': `/// The nth Fibonacci number.
pub fn fibonacci(n: u64) -> u64 {
    let (mut a, mut b) = (0, 1);
    for _ in 0..n {
        (a, b) = (b, a + b);
    }
    a
}
`
					}
				};
			case 'c':
				return {
					files: {
						Makefile: makefile('gcc', 'c', '-std=c23'),
						'src/main.c': `#include <stdio.h>
#include "fib.h"

int main(void) {
    for (int i = 0; i < 10; i++) printf("fib(%d) = %ld\\n", i, fibonacci(i));
    return 0;
}
`,
						'src/fib.h': `#pragma once

long fibonacci(int n);
`,
						'src/fib.c': `#include "fib.h"

long fibonacci(int n) {
    long a = 0, b = 1;
    for (int i = 0; i < n; i++) {
        long t = a + b;
        a = b;
        b = t;
    }
    return a;
}
`
					}
				};
			case 'cpp':
				return {
					files: {
						Makefile: makefile('g++', 'cpp', '-std=c++23'),
						'src/main.cpp': `#include <print>
#include "fib.h"

int main() {
    for (int i = 0; i < 10; i++) std::println("fib({}) = {}", i, fibonacci(i));
}
`,
						'src/fib.h': `#pragma once

long fibonacci(int n);
`,
						'src/fib.cpp': `#include "fib.h"

long fibonacci(int n) {
    long a = 0, b = 1;
    for (int i = 0; i < n; i++) {
        long t = a + b;
        a = b;
        b = t;
    }
    return a;
}
`
					}
				};
			case 'ruby':
				return {
					files: {
						'main.rb': `require_relative 'lib/fib'

10.times { |i| puts "fib(#{i}) = #{fibonacci(i)}" }
`,
						'lib/fib.rb': `# The nth Fibonacci number.
def fibonacci(n)
  a, b = 0, 1
  n.times { a, b = b, a + b }
  a
end
`,
						Gemfile: `source "https://rubygems.org"\n`
					}
				};
			case 'bash':
				return {
					files: {
						'main.sh': `#!/bin/bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

for i in $(seq 0 9); do
  echo "fib($i) = $(fibonacci "$i")"
done
`,
						'lib.sh': `# The nth Fibonacci number.
fibonacci() {
  local a=0 b=1 t
  for ((i = 0; i < $1; i++)); do
    t=$((a + b)); a=$b; b=$t
  done
  echo "$a"
}
`
					}
				};
		}
	})();
	const ignore = GITIGNORE[language];
	if (ignore) t.files['.gitignore'] = ignore;
	// A git repository from the start, as an editor's "new project" leaves it.
	t.init = [t.init, 'git init -q 2>/dev/null || true'].filter(Boolean).join(' && ');
	return t;
}

/** Every file with these extensions, outside SKIPPED_DIRS, for the per-file checkers. */
const filesWith = (...exts: string[]) =>
	`find . ${PRUNE} -o -type f \\( ${exts.map((e) => `-name '*.${e}'`).join(' -o ')} \\) -print | head -n 500`;

/** Parses every .py file and prints one JSON line per syntax error (all files, not just the first error). */
const PYTHON_CHECK = `import ast, json, os
skip = set(${JSON.stringify(SKIPPED_DIRS)})
for root, dirs, files in os.walk('.'):
    dirs[:] = [d for d in dirs if d not in skip]
    for f in files:
        if not f.endswith('.py'):
            continue
        path = os.path.join(root, f)[2:]
        try:
            with open(path, encoding='utf-8') as fh:
                ast.parse(fh.read(), path)
        except SyntaxError as e:
            print(json.dumps({"path": path, "line": e.lineno or 1, "column": e.offset or 1, "message": f"{type(e).__name__}: {e.msg}"}))
        except Exception:
            pass
`;

/**
 * The command that checks a project of `language` in /workspace and prints
 * what parseDiagnostics reads. JavaScript is not here: Monaco's TypeScript
 * worker checks it as you type.
 */
export const CHECK_COMMAND: Partial<Record<Language, string>> = {
	python: `python3 -c ${sq(PYTHON_CHECK)}`,
	// gofmt -e reports every syntax error; vet (types, unused names) only runs once the syntax is right.
	go: `out=$(gofmt -e -l . 2>&1 >/dev/null); if [ -n "$out" ]; then echo "$out"; elif [ -f go.mod ]; then go vet ./... 2>&1; fi`,
	rust: `if [ -f Cargo.toml ]; then cargo check --quiet --message-format=short 2>&1; fi`,
	c: `${filesWith('c')} | while read -r f; do gcc -std=c23 -fsyntax-only -Wall -Wextra -Isrc -Iinclude "$f"; done 2>&1`,
	cpp: `${filesWith('cpp', 'cc', 'cxx')} | while read -r f; do g++ -std=c++23 -fsyntax-only -Wall -Wextra -Isrc -Iinclude "$f"; done 2>&1`,
	ruby: `${filesWith('rb')} | while read -r f; do ruby -wc "$f" >/dev/null; done 2>&1`,
	bash: `${filesWith('sh', 'bash')} | while read -r f; do bash -n "$f"; done 2>&1`
};

/** Seconds a check may take: cargo check builds the dependencies the first time. */
export const CHECK_TIMEOUT: Partial<Record<Language, number>> = { rust: 300, go: 120 };
