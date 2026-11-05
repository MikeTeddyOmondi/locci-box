<script lang="ts">
	import { ChevronDown, CircleAlert, CircleX, Info, Palette, Plus, SquareTerminal, TriangleAlert, X } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import BoxTerminal, { TERMINAL_THEMES } from '$lib/components/BoxTerminal.svelte';
	import * as Select from '$lib/components/ui/select';
	import { confirmDialog } from '$lib/confirm.svelte';
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
		/** A terminal printed something (a command may have changed files). */
		onActivity?: () => void;
	}

	let { boxId, problems, tab = $bindable(), onJump, onHide, onActivity }: Props = $props();

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

	async function closeTerminal(id: number) {
		let i = sessions.findIndex((s) => s.id === id);
		if (i < 0) return;
		// A command still running is stopped with its shell, so that is asked first.
		const command = terminals[id]?.runningCommand();
		if (command != null) {
			const ok = await confirmDialog({
				title: `Kill terminal ${i + 1}?`,
				description: `${command ? `"${command}"` : 'A command'} is still running in it. Killing the terminal stops it.`,
				confirmLabel: 'Kill terminal',
				destructive: true
			});
			i = sessions.findIndex((s) => s.id === id);
			if (!ok || i < 0) return;
		}
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
	<!-- Icons, as in VS Code's panel bar, so it fits a phone; each says what it is on hover and to screen readers. -->
	<div class="flex shrink-0 items-center gap-1 border-b px-1.5">
		<button
			type="button"
			class={['relative flex cursor-pointer items-center gap-1 border-b-2 px-1.5 py-1.5', tab === 'problems' ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground']}
			aria-label="Problems ({problems.length})"
			aria-pressed={tab === 'problems'}
			title="Problems"
			onclick={() => (tab = 'problems')}
		>
			<CircleAlert class="size-4" />
			{#if problems.length}<span class="rounded-full bg-muted px-1.5 text-[10px] leading-4">{problems.length}</span>{/if}
		</button>
		<button
			type="button"
			class={['flex cursor-pointer items-center border-b-2 px-1.5 py-1.5', tab === 'terminal' ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground']}
			aria-label="Terminal"
			aria-pressed={tab === 'terminal'}
			title="Terminal"
			onclick={() => (tab = 'terminal')}
		>
			<SquareTerminal class="size-4" />
		</button>
		<div class="min-w-2 flex-1"></div>
		{#if tab === 'terminal'}
			<div class="flex min-w-0 items-center gap-0.5">
				<!-- One chip per shell: its number, an X to kill it; an ended one is struck through. -->
				<div class="flex min-w-0 items-center gap-0.5 overflow-x-auto">
					{#each sessions as s, i (s.id)}
						<div
							class={[
								'flex shrink-0 items-center rounded font-mono text-[11px]',
								s.id === activeId ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/50'
							]}
						>
							<button
								type="button"
								class={['flex cursor-pointer items-center gap-1 py-1 pl-1.5', s.ended && 'line-through opacity-60']}
								aria-label="Terminal {i + 1}{s.ended ? ', ended' : ''}"
								title="bash {i + 1}{s.ended ? ' (ended)' : ''}"
								onclick={() => (activeId = s.id)}
							>
								<SquareTerminal class="size-3.5" />{i + 1}
							</button>
							<button type="button" class="cursor-pointer px-1 py-1 opacity-60 hover:opacity-100" aria-label="Kill terminal {i + 1}" title="Kill terminal {i + 1}" onclick={() => closeTerminal(s.id)}>
								<X class="size-3" />
							</button>
						</div>
					{/each}
				</div>
				<button type="button" class="shrink-0 cursor-pointer rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" title="New terminal" aria-label="New terminal" onclick={() => addTerminal()}>
					<Plus class="size-4" />
				</button>
				<Select.Root type="single" value={terminalTheme.current} onValueChange={(v) => terminalTheme.set(v)}>
					<Select.Trigger
						size="sm"
						class="h-7 w-auto shrink-0 gap-0.5 border-0 px-1.5 text-muted-foreground shadow-none hover:bg-accent hover:text-foreground dark:bg-transparent"
						aria-label="Terminal theme: {TERMINAL_THEMES[terminalTheme.current].label}"
						title="Terminal theme: {TERMINAL_THEMES[terminalTheme.current].label}"
					>
						<Palette class="size-4" />
					</Select.Trigger>
					<Select.Content align="end">
						{#each Object.entries(TERMINAL_THEMES) as [value, { label }] (value)}
							<Select.Item {value} class="text-xs">{label}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
		{/if}
		<button type="button" class="shrink-0 cursor-pointer rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" title="Hide the panel (Cmd/Ctrl+J)" aria-label="Hide the panel" onclick={onHide}>
			<ChevronDown class="size-4" />
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
						class="flex w-full cursor-pointer flex-wrap items-start gap-x-2 py-0.5 pr-3 pl-3 text-left text-xs hover:bg-accent/50 sm:flex-nowrap sm:pl-6"
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
						<span class="basis-full pl-5.5 text-muted-foreground sm:basis-auto sm:shrink-0 sm:pl-0">{d.source} [Ln {d.line}, Col {d.column}]</span>
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
					onOutput={onActivity}
					onClose={() => (s.ended = true)}
				/>
			</div>
		{/each}
	</div>
</div>
