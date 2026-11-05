import { error } from '@sveltejs/kit';
import { command, query } from '$app/server';
import * as v from 'valibot';
import { boxApi } from '$lib/server/box-api';
import { CHECK_COMMAND, CHECK_TIMEOUT, dirCommand, sq, template, TREE_COMMAND, workspacePath } from '$lib/server/projects';
import { parseDiagnostics } from '$lib/diagnostics';
import { LANGUAGES, type BoxInfo, type Diagnostic, type Language, type TreeEntry } from '$lib/types';
import { getBoxes } from './boxes.remote';

/**
 * Code projects: a box per project, with a name and a language. Files, the
 * tree and checks go through the box API's file and exec routes.
 */

interface ExecResult {
	exit_code: number;
	stdout: string;
	stderr: string;
	timed_out: boolean;
}

const exec = (id: string, cmd: string, timeout = 60) =>
	boxApi<ExecResult>(`/api/boxes/${encodeURIComponent(id)}/exec`, { method: 'POST', json: { command: cmd, timeout } });

/** A path from the browser, checked before it goes near a shell. */
function pathOf(path: string): string {
	const safe = workspacePath(path);
	if (!safe) error(400, `Not a path inside the project: ${path}`);
	return safe;
}

const Name = v.pipe(v.string(), v.trim(), v.minLength(1, 'Give the project a name'), v.maxLength(64, 'At most 64 characters'));
const At = v.object({ id: v.string(), path: v.string() });

export const getProjects = query(async () => {
	const boxes = await boxApi<BoxInfo[]>('/api/boxes');
	return boxes
		.filter((b) => b.name)
		.sort((a, b) => b.last_used_at.localeCompare(a.last_used_at));
});

/** One project, read fresh each time (its state changes as the box starts and idles). */
export const getProject = command(v.string(), async (id) => boxApi<BoxInfo>(`/api/boxes/${encodeURIComponent(id)}`));

/**
 * A new project: a box for the language, the template's files, then its init
 * (npm init, cargo init, go mod init, git init). A failed init leaves the box
 * and its files and says what went wrong.
 */
export const createProject = command(v.object({ name: Name, language: v.picklist(LANGUAGES) }), async ({ name, language }) => {
	const box = await boxApi<BoxInfo>('/api/boxes', { method: 'POST', json: { language, name } });
	const { files, init } = template(language, name);
	for (const [path, content] of Object.entries(files)) {
		if (path === 'src/main.rs' || path === 'src/math.rs') continue; // after cargo init, which writes src/main.rs
		await boxApi(`/api/boxes/${box.box_id}/files`, { method: 'PUT', json: { path, content } });
	}
	let initError: string | null = null;
	if (init) {
		const r = await exec(box.box_id, init, 180);
		if (r.exit_code !== 0) initError = (r.stderr || r.stdout).trim().slice(-500) || `init exited with ${r.exit_code}`;
	}
	for (const path of ['src/main.rs', 'src/math.rs']) {
		if (files[path] !== undefined) await boxApi(`/api/boxes/${box.box_id}/files`, { method: 'PUT', json: { path, content: files[path] } });
	}
	await Promise.all([getProjects().refresh(), getBoxes().refresh()]);
	return { box, initError };
});

export const renameProject = command(v.object({ id: v.string(), name: Name }), async ({ id, name }) => {
	const box = await boxApi<BoxInfo>(`/api/boxes/${encodeURIComponent(id)}`, { method: 'PATCH', json: { name } });
	await getProjects().refresh();
	return box;
});

export const deleteProject = command(v.string(), async (id) => {
	await boxApi(`/api/boxes/${encodeURIComponent(id)}`, { method: 'DELETE' });
	await Promise.all([getProjects().refresh(), getBoxes().refresh()]);
	return { success: true as const };
});

/** The project's files and folders (folders end in "/"). Starts a stopped box. */
export const getTree = command(v.string(), async (id): Promise<TreeEntry[]> => {
	const r = await exec(id, TREE_COMMAND, 30);
	if (r.exit_code !== 0) error(502, r.stderr.trim() || 'Could not list the project');
	return r.stdout
		.split('\n')
		.filter((p) => p && p !== '/')
		.sort((a, b) => a.localeCompare(b));
});

/** One level of a folder the tree lists without opening (build, target, node_modules...); empty once it is gone. */
export const getDir = command(At, async ({ id, path }): Promise<TreeEntry[]> => {
	const r = await exec(id, dirCommand(pathOf(path)), 30);
	return r.stdout.split('\n').filter(Boolean);
});

export const readProjectFile = command(At, async ({ id, path }) => {
	const file = await boxApi<{ content: string; encoding: 'utf8' | 'base64'; truncated: boolean; size: number }>(
		`/api/boxes/${encodeURIComponent(id)}/files?path=${encodeURIComponent(pathOf(path))}`
	);
	return { content: file.encoding === 'utf8' ? file.content : null, truncated: file.truncated, size: file.size };
});

export const saveProjectFile = command(v.object({ id: v.string(), path: v.string(), content: v.string() }), async ({ id, path, content }) => {
	await boxApi(`/api/boxes/${encodeURIComponent(id)}/files`, { method: 'PUT', json: { path: pathOf(path), content } });
	return { success: true as const };
});

/** A new empty file or folder; refuses one that is already there. */
export const createPath = command(v.object({ id: v.string(), path: v.string(), folder: v.boolean() }), async ({ id, path, folder }) => {
	const p = sq(pathOf(path));
	const cmd = folder
		? `[ -e ${p} ] && { echo 'Already exists' >&2; exit 3; }; mkdir -p ${p}`
		: `[ -e ${p} ] && { echo 'Already exists' >&2; exit 3; }; mkdir -p "$(dirname ${p})" && : > ${p}`;
	const r = await exec(id, cmd, 15);
	if (r.exit_code !== 0) error(r.exit_code === 3 ? 409 : 502, `${path}: ${r.stderr.trim() || 'could not be created'}`);
	return { success: true as const };
});

export const renamePath = command(v.object({ id: v.string(), from: v.string(), to: v.string() }), async ({ id, from, to }) => {
	const [a, b] = [sq(pathOf(from)), sq(pathOf(to))];
	const r = await exec(id, `[ -e ${b} ] && { echo 'Already exists' >&2; exit 3; }; mkdir -p "$(dirname ${b})" && mv ${a} ${b}`, 15);
	if (r.exit_code !== 0) error(r.exit_code === 3 ? 409 : 502, `${to}: ${r.stderr.trim() || 'could not be renamed'}`);
	return { success: true as const };
});

/**
 * Copy and Duplicate in the Explorer. Folders are copied whole. Plain `cp -R`:
 * `cp -a` fails on the box's shared /workspace when it sets ownership.
 */
export const copyPath = command(v.object({ id: v.string(), from: v.string(), to: v.string() }), async ({ id, from, to }) => {
	const [a, b] = [sq(pathOf(from)), sq(pathOf(to))];
	const r = await exec(id, `[ -e ${b} ] && { echo 'Already exists' >&2; exit 3; }; mkdir -p "$(dirname ${b})" && cp -R ${a} ${b}`, 60);
	if (r.exit_code !== 0) error(r.exit_code === 3 ? 409 : 502, `${to}: ${r.stderr.trim() || 'could not be copied'}`);
	return { success: true as const };
});

export const deletePath = command(At, async ({ id, path }) => {
	const r = await exec(id, `rm -rf -- ${sq(pathOf(path))}`, 30);
	if (r.exit_code !== 0) error(502, r.stderr.trim() || `${path} could not be deleted`);
	return { success: true as const };
});

/**
 * Check the project with its language's own tools, in the box (see
 * CHECK_COMMAND). Diagnostics for every file, not just the open one.
 */
export const checkProject = command(
	v.object({ id: v.string(), language: v.picklist(LANGUAGES) }),
	async ({ id, language }): Promise<{ diagnostics: Diagnostic[]; checked: boolean }> => {
		const cmd = CHECK_COMMAND[language as Language];
		if (!cmd) return { diagnostics: [], checked: false };
		const r = await exec(id, cmd, CHECK_TIMEOUT[language] ?? 60);
		if (r.timed_out) return { diagnostics: [], checked: false };
		return { diagnostics: parseDiagnostics(language, `${r.stdout}\n${r.stderr}`), checked: true };
	}
);
