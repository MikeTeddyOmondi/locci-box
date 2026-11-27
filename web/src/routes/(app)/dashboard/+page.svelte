<script lang="ts">
	import { Activity, Boxes, CircleCheck, Play, Timer } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import BarChart from '$lib/components/charts/BarChart.svelte';
	import StatCard from '$lib/components/charts/StatCard.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import { LANGUAGE_LABELS, type Language } from '$lib/types';
	import { errMessage, formatDate } from '$lib/utils';
	import { getBoxes } from '../../boxes.remote';
	import { getActiveSandboxes, getStats, stopSandbox } from '../../sandbox.remote';

	let { data } = $props();

	/**
	 * Held query instances, as on locci-platform's dashboard: an inline call in
	 * `{#await}` would mint a new handle each render and miss refreshes.
	 */
	const statsQuery = getStats();
	const activeQuery = getActiveSandboxes();
	const boxesQuery = getBoxes();

	const label = (language: string) => LANGUAGE_LABELS[language as Language] ?? language;
	const ms = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)} s` : `${Math.round(n)} ms`);

	function byLanguage(runs: { language: string }[]) {
		const counts = new Map<string, number>();
		for (const r of runs) counts.set(label(r.language), (counts.get(label(r.language)) ?? 0) + 1);
		return [...counts].map(([l, value]) => ({ label: l, value })).sort((a, b) => b.value - a.value);
	}

	function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
		if (status === 'completed') return 'secondary';
		if (status === 'running') return 'default';
		return 'destructive';
	}

	async function stop(id: string) {
		try {
			await stopSandbox(id);
			toast.success('Sandbox stopped');
		} catch (err) {
			toast.error(errMessage(err, 'Could not stop the sandbox'));
		}
	}
</script>

<svelte:head><title>Overview · Locci Box</title></svelte:head>

<div class="mx-auto w-full max-w-6xl space-y-8 p-4 lg:p-6">
	<div class="flex flex-wrap items-end justify-between gap-4">
		<div>
			<h1 class="text-3xl font-bold">Overview</h1>
			<p class="mt-1 text-muted-foreground">Your sandbox runs and agent boxes, signed in as {data.user.email}</p>
		</div>
		<Button href="/code"><Play class="size-4" /> Run code</Button>
	</div>

	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		{#await statsQuery}
			<StatCard label="Runs" value="..." loading icon={Activity} />
			<StatCard label="Success rate" value="..." loading icon={CircleCheck} />
			<StatCard label="Average run" value="..." loading icon={Timer} />
		{:then stats}
			<StatCard
				label="Runs"
				value={stats.total_runs}
				hint="{stats.active_sandboxes} running now"
				icon={Activity}
				trend={stats.daily_runs.map((d) => d.runs)}
			/>
			<StatCard
				label="Success rate"
				value={stats.total_runs ? `${Math.round((stats.success_runs / stats.total_runs) * 100)}%` : 'n/a'}
				hint="{stats.success_runs} exited 0"
				icon={CircleCheck}
			/>
			<StatCard label="Average run" value={ms(stats.avg_execution_ms)} hint="wall time per run" icon={Timer} />
		{:catch err}
			<StatCard label="Runs" value="!" hint={errMessage(err, 'API unreachable')} icon={Activity} />
		{/await}
		{#await boxesQuery}
			<StatCard label="Boxes" value="..." loading href="/boxes" icon={Boxes} />
		{:then boxes}
			<StatCard
				label="Boxes"
				value={boxes.length}
				hint="{boxes.filter((b) => b.status === 'running').length} running"
				href="/boxes"
				icon={Boxes}
			/>
		{:catch}
			<StatCard label="Boxes" value="!" hint="API unreachable" href="/boxes" icon={Boxes} />
		{/await}
	</div>

	<div class="grid gap-4 lg:grid-cols-3">
		<Card.Root class="lg:col-span-2">
			<Card.Header>
				<Card.Title>Recent runs</Card.Title>
				<Card.Description>The last runs of your code, newest first</Card.Description>
			</Card.Header>
			<Card.Content>
				{#await statsQuery}
					<p class="py-6 text-center text-sm text-muted-foreground">Loading...</p>
				{:then stats}
					{#if stats.recent_runs.length === 0}
						<p class="py-6 text-center text-sm text-muted-foreground">
							No runs yet. <a href="/code" class="underline">Run some code</a>.
						</p>
					{:else}
						<div class="overflow-x-auto">
							<Table.Root>
								<Table.Header>
									<Table.Row>
										<Table.Head>Language</Table.Head>
										<Table.Head>Status</Table.Head>
										<Table.Head class="text-right">Exit</Table.Head>
										<Table.Head class="text-right">Time</Table.Head>
										<Table.Head>When</Table.Head>
									</Table.Row>
								</Table.Header>
								<Table.Body>
									{#each stats.recent_runs as run (run.sandbox_id)}
										<Table.Row>
											<Table.Cell class="font-medium">{label(run.language)}</Table.Cell>
											<Table.Cell><Badge variant={statusVariant(run.status)}>{run.status}</Badge></Table.Cell>
											<Table.Cell class="text-right font-mono">{run.exit_code ?? ''}</Table.Cell>
											<Table.Cell class="text-right">{ms(run.duration_ms ?? 0)}</Table.Cell>
											<Table.Cell class="text-muted-foreground">{formatDate(run.created_at)}</Table.Cell>
										</Table.Row>
									{/each}
								</Table.Body>
							</Table.Root>
						</div>
					{/if}
				{:catch err}
					<p class="py-6 text-center text-sm text-muted-foreground">{errMessage(err)}</p>
				{/await}
			</Card.Content>
		</Card.Root>

		<div class="space-y-4">
			<Card.Root>
				<Card.Header>
					<Card.Title>Languages</Card.Title>
					<Card.Description>Recent runs by language</Card.Description>
				</Card.Header>
				<Card.Content>
					{#await statsQuery then stats}
						<BarChart data={byLanguage(stats.recent_runs)} />
					{/await}
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header>
					<Card.Title>Running now</Card.Title>
					<Card.Description>Sandboxes still executing</Card.Description>
				</Card.Header>
				<Card.Content>
					{#await activeQuery}
						<p class="text-sm text-muted-foreground">Loading...</p>
					{:then active}
						{#if active.length === 0}
							<p class="text-sm text-muted-foreground">Nothing running.</p>
						{:else}
							<ul class="space-y-2">
								{#each active as sb (sb.sandbox_id)}
									<li class="flex items-center justify-between gap-2 text-sm">
										<span class="truncate font-mono" title={sb.sandbox_id}>{label(sb.language)}</span>
										<Button size="sm" variant="outline" onclick={() => stop(sb.sandbox_id)}>Stop</Button>
									</li>
								{/each}
							</ul>
						{/if}
					{:catch}
						<p class="text-sm text-muted-foreground">API unreachable</p>
					{/await}
				</Card.Content>
			</Card.Root>
		</div>
	</div>
</div>
