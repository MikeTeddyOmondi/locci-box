/**
 * Shapes the Locci Box API returns, shared by the remote functions and the pages.
 */

export const LANGUAGES = ['python', 'node', 'bash', 'ruby', 'go', 'rust', 'c', 'cpp'] as const;
export type Language = (typeof LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<Language, string> = {
	python: 'Python',
	node: 'Node.js',
	bash: 'Bash',
	ruby: 'Ruby',
	go: 'Go',
	rust: 'Rust',
	c: 'C',
	cpp: 'C++'
};

export interface RunParams {
	language: Language;
	code: string;
	timeout?: number;
}

export interface SandboxResult {
	sandbox_id: string;
	status: 'running' | 'completed' | 'failed' | 'timeout';
	stdout: string;
	stderr: string;
	exit_code: number;
	duration_ms: number;
	created_at: string;
	completed_at: string;
}

export interface SandboxInfo {
	sandbox_id: string;
	tenant_id: string;
	language: string;
	status: 'running' | 'completed' | 'failed' | 'timeout';
	created_at: string;
	uptime_ms?: number;
}

export interface RecentRun {
	sandbox_id: string;
	language: string;
	status: string;
	exit_code: number;
	duration_ms: number;
	created_at: string;
}

export interface StatsData {
	tenant_id: string;
	organization: string;
	total_runs: number;
	active_sandboxes: number;
	avg_execution_ms: number;
	success_runs: number;
	recent_runs: RecentRun[];
	daily_runs: { day: string; runs: number }[];
	last_activity: string;
}

export interface BoxInfo {
	box_id: string;
	status: 'running' | 'stopped';
	image: string;
	memory_mib: number;
	workdir: string;
	created_at: string;
	started_at: string;
	last_used_at: string;
	stopped_at: string | null;
	idle_stop_at: string | null;
}

export interface BoxExecResult {
	box_id: string;
	exit_code: number;
	stdout: string;
	stderr: string;
	duration_ms: number;
	timed_out: boolean;
	truncated: boolean;
}

export interface BobThread {
	id: string;
	title: string;
	updatedAt: string;
}

/** A Locci API key as Locci Auth lists it (the secret itself is shown once, at creation). */
export interface ApiKeySummary {
	id: string;
	name: string;
	prefix: string;
	scopes: string[] | null;
	expiresAt: string | null;
	lastUsedAt: string | null;
	createdAt: string;
}
