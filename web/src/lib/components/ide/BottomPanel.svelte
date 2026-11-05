<script lang="ts">
	import { ChevronDown, CircleX, Info, Plus, SquareTerminal, TriangleAlert, X } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import BoxTerminal, { TERMINAL_THEMES } from '$lib/components/BoxTerminal.svelte';
	import * as Select from '$lib/components/ui/select';
	import { terminalTheme } from '$lib/terminal-theme.svelte';
	import type { Diagnostic } from '$lib/types';

	/**
	 * The panel under the editor, as in VS Code: PROBLEMS (every error and
	 * warning in the project, a click jumps to it) and TERMINAL (shells in the
	 * project's box, several at once, the + adds one).
	 */

	interface Props {
		boxId: string;
		problems: Diagnostic[];
		tab: 'problems' | 'terminal';
		onJump: (d: Diagnostic) => void;
		onHide: () => void;
	}

	let { boxId, problems, tab = $bindable(), onJump, onHide }: Props = $props();

	onMount(() => terminalTheme.load());

	interface Session {
		id: number;
		/** Set once the shell has ended (exit, or the box stopped). */
		ended: boolean;
		/** Asked for (the + button, Run), so it takes the keyboard; the one opened with the project does not. */
		focus: boolean;
	}

	let next = 1;
	let sessions = $state<Session[]>([]);
	let activeId = $state<number | null>(null);
	const terminals: Record<number, ReturnType<typeof BoxTerminal> | undefined> = $state({});

	function addTerminal(focus = true): number {
		const id = next++;
		sessions.push({ id, ended: false, focus });
		activeId = id;
		tab = 'terminal';
		return id;
	}

	function closeTerminal(id: number) {
		const i = sessions.findIndex((s) => s.id === id);
		if (i < 0) return;
		sessions.splice(i, 1);
		delete terminals[id];
		if (activeId === id) activeId = sessions.at(Math.max(0, i - 1))?.id ?? null;
	}

	// The terminal tab opens on one shell.
	$effect(() => {
		if (tab === 'terminal' && sessions.length === 0) addTerminal(false);
	});

	/**
	 * Type `command` into the open terminal (a new one when there is none, or it
	 * has ended), waiting for the shell to take input: a stopped box starts first.
	 */
	export async function run(command: string) {
		tab = 'terminal';
		let session = sessions.find((s) => s.id === activeId && !s.ended);
		const id = session?.id ?? addTerminal();
		const deadline = Date.now() + 120_000;
		while (Date.now() < deadline) {
			const term = terminals[id];
			if (!sessions.some((s) => s.id === id)) return; // closed meanwhile
			if (term?.send(`${command}\r`)) return;
			await new Promise((r) => setTimeout(r, 250));
		}
	}

	const counts = $derived({
		errors: problems.filter((p) => p.severity === 'error').length,
		warnings: problems.filter((p) => p.severity === 'warning').length
	});

	/** Problems by file, files in order. */
	const byFile = $derived.by(() => {
		const groups = new Map<string, Diagnostic[]>();
		for (const p of problems) {
			const list = groups.get(p.path) ?? [];
			list.push(p);
			groups.set(p.path, list);
		}
		return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
	});
</script>

<div class="flex h-full min-h-0 flex-col bg-background">
	<div class="flex shrink-0 items-center gap-4 border-b px-3 text-[11px] font-medium tracking-wider uppercase">
		<button
			type="button"
			class={['cursor-pointer border-b py-1.5', tab === 'problems' ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground']}
			onclick={() => (tab = 'problems')}
		>
			Problems
			{#if problems.length}<span class="ml-1 rounded-full bg-muted px-1.5 py-px text-[10px]">{problems.length}</span>{/if}
		</button>
		<button
			type="button"
			class={['cursor-pointer border-b py-1.5', tab === 'terminal' ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground']}
			onclick={() => (tab = 'terminal')}
		>
			Terminal
		</button>
		<div class="flex-1"></div>
		{#if tab === 'terminal'}
			<div class="flex items-center gap-1 normal-case tracking-normal">
				{#each sessions as s, i (s.id)}
					<div
						class={[
							'group flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[11px]',
							s.id === activeId ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/50'
						]}
					>
						<button type="button" class="flex cursor-pointer items-center gap-1" onclick={() => (activeId = s.id)}>
							<SquareTerminal class="size-3" />
							bash {i + 1}{s.ended ? ' (ended)' : ''}
						</button>
						<button type="button" class="cursor-pointer opacity-60 hover:opacity-100" aria-label="Kill terminal {i + 1}" onclick={() => closeTerminal(s.id)}>
							<X class="size-3" />
						</button>
					</div>
				{/each}
				<button type="button" class="cursor-pointer rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" title="New terminal" aria-label="New terminal" onclick={() => addTerminal()}>
					<Plus class="size-3.5" />
				</button>
				<Select.Root type="single" value={terminalTheme.current} onValueChange={(v) => terminalTheme.set(v)}>
					<Select.Trigger size="sm" class="h-6 w-32 text-[11px]" aria-label="Terminal theme">{TERMINAL_THEMES[terminalTheme.current].label}</Select.Trigger>
					<Select.Content>
						{#each Object.entries(TERMINAL_THEMES) as [value, { label }] (value)}
							<Select.Item {value} class="text-xs">{label}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
		{/if}
		<button type="button" class="cursor-pointer rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" title="Hide the panel (Cmd/Ctrl+J)" aria-label="Hide the panel" onclick={onHide}>
			<ChevronDown class="size-3.5" />
		</button>
	</div>

	<!-- Terminals stay mounted while Problems shows, so their shells keep running. -->
	<div class={['min-h-0 flex-1 overflow-auto', tab !== 'problems' && 'hidden']}>
		{#if problems.length === 0}
			<p class="px-3 py-2 text-xs text-muted-foreground">No problems have been detected in the project.</p>
		{:else}
			<p class="sr-only">{counts.errors} errors, {counts.warnings} warnings</p>
			{#each byFile as [path, list] (path)}
				<div class="px-3 pt-1.5 font-mono text-xs font-medium">
					{path} <span class="ml-1 rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">{list.length}</span>
				</div>
				{#each list as d, i (`${d.line}:${d.column}:${d.source}:${i}`)}
					<button
						type="button"
						class="flex w-full cursor-pointer items-start gap-2 py-0.5 pr-3 pl-6 text-left text-xs hover:bg-accent/50"
						onclick={() => onJump(d)}
					>
						{#if d.severity === 'error'}
							<CircleX class="mt-0.5 size-3.5 shrink-0 text-red-600 dark:text-red-400" />
						{:else if d.severity === 'warning'}
							<TriangleAlert class="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
						{:else}
							<Info class="mt-0.5 size-3.5 shrink-0 text-sky-600 dark:text-sky-400" />
						{/if}
						<span class="min-w-0 flex-1">{d.message}</span>
						<span class="shrink-0 text-muted-foreground">{d.source} [Ln {d.line}, Col {d.column}]</span>
					</button>
				{/each}
			{/each}
		{/if}
	</div>
	<div class={['relative min-h-0 flex-1', tab !== 'terminal' && 'hidden']}>
		{#each sessions as s (s.id)}
			<div class={['absolute inset-0 p-1', s.id !== activeId && 'invisible']}>
				<BoxTerminal
					bind:this={terminals[s.id]}
					{boxId}
					theme={terminalTheme.current}
					focusOnOpen={s.focus}
					onClose={() => (s.ended = true)}
				/>
			</div>
		{/each}
	</div>
</div>
