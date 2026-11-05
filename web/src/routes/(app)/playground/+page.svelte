<script lang="ts">
	import { FlaskConical, Plus, RotateCcw, Trash2 } from '@lucide/svelte';
	import CodeEditor from '$lib/components/CodeEditor.svelte';
	import RunOutput, { type RunResult } from '$lib/components/RunOutput.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Select from '$lib/components/ui/select';
	import { CODE_STARTER, MONACO_LANGUAGE, TEST_STARTER } from '$lib/languages';
	import { LANGUAGE_LABELS, LANGUAGES, type Language } from '$lib/types';
	import { errMessage } from '$lib/utils';
	import { runCode } from '../../sandbox.remote';

	/**
	 * Code on the left, tests on the right, run together (code, then tests) in
	 * one fresh microVM; a pass is exit 0. Add pairs to try variants side by side,
	 * each in its own microVM.
	 */

	interface Pair {
		id: string;
		code: string;
		tests: string;
		running: boolean;
		result: RunResult | null;
	}

	let language = $state<Language>('python');

	const pair = (l: Language): Pair => ({
		id: crypto.randomUUID(),
		code: CODE_STARTER[l],
		tests: TEST_STARTER[l],
		running: false,
		result: null
	});

	let pairs = $state<Pair[]>([pair('python')]);

	function changeLanguage(l: Language) {
		language = l;
		pairs = [pair(l)];
	}

	async function run(p: Pair) {
		if (p.running || !p.tests.trim()) return;
		p.running = true;
		p.result = null;
		try {
			const r = await runCode({ language, code: `${p.code}\n${p.tests}`, timeout: 30 });
			p.result = { stdout: r.stdout, stderr: r.stderr, exit: r.exit_code, ms: r.duration_ms };
		} catch (err) {
			p.result = { stdout: '', stderr: '', exit: 1, ms: 0, error: errMessage(err, 'The run failed') };
		} finally {
			p.running = false;
		}
	}

	const runAll = () => Promise.all(pairs.map(run));
</script>

<svelte:head><title>Playground · Locci Box</title></svelte:head>

<div class="mx-auto w-full max-w-7xl space-y-4 p-4 lg:p-6">
	<div class="flex flex-wrap items-end justify-between gap-4">
		<div>
			<h1 class="text-3xl font-bold">Playground</h1>
			<p class="mt-1 text-muted-foreground">Write code and its tests side by side; each pair runs in its own microVM.</p>
		</div>
		<div class="flex items-center gap-2">
			<Select.Root type="single" value={language} onValueChange={(v) => changeLanguage(v as Language)}>
				<Select.Trigger class="w-36" aria-label="Language">{LANGUAGE_LABELS[language]}</Select.Trigger>
				<Select.Content>
					{#each LANGUAGES as l (l)}
						<Select.Item value={l}>{LANGUAGE_LABELS[l]}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
			<Button variant="outline" onclick={() => pairs.push(pair(language))}><Plus class="size-4" /> Add pair</Button>
			<Button onclick={runAll} disabled={pairs.some((p) => p.running)}><FlaskConical class="size-4" /> Run all</Button>
		</div>
	</div>

	{#each pairs as p, i (p.id)}
		<Card.Root class="overflow-hidden">
			<div class="flex items-center gap-2 border-b px-4 py-2">
				<span class="text-sm font-medium">Pair {i + 1}</span>
				{#if p.running}
					<Badge variant="secondary">running</Badge>
				{:else if p.result && !p.result.error}
					<Badge variant={p.result.exit === 0 ? 'default' : 'destructive'}>{p.result.exit === 0 ? 'passed' : 'failed'}</Badge>
				{/if}
				<div class="flex-1"></div>
				<Button size="icon" variant="ghost" aria-label="Reset pair {i + 1}" onclick={() => Object.assign(p, pair(language), { id: p.id })}>
					<RotateCcw class="size-4" />
				</Button>
				{#if pairs.length > 1}
					<Button size="icon" variant="ghost" aria-label="Remove pair {i + 1}" onclick={() => pairs.splice(i, 1)}>
						<Trash2 class="size-4" />
					</Button>
				{/if}
				<Button size="sm" onclick={() => run(p)} disabled={p.running}>Run tests</Button>
			</div>
			<div class="grid lg:grid-cols-2">
				<div class="border-b lg:border-r lg:border-b-0">
					<p class="px-4 pt-2 text-xs font-medium text-muted-foreground">Code</p>
					{#key language}
						<CodeEditor bind:value={p.code} language={MONACO_LANGUAGE[language]} onRun={() => run(p)} class="h-72" ariaLabel="Code, pair {i + 1}" />
					{/key}
				</div>
				<div>
					<p class="px-4 pt-2 text-xs font-medium text-muted-foreground">Tests</p>
					{#key language}
						<CodeEditor bind:value={p.tests} language={MONACO_LANGUAGE[language]} onRun={() => run(p)} class="h-72" ariaLabel="Tests, pair {i + 1}" />
					{/key}
				</div>
			</div>
			<div class="h-40 border-t">
				<RunOutput result={p.result} running={p.running} empty="Run the tests: code and tests run as one program." />
			</div>
		</Card.Root>
	{/each}
</div>
