<script lang="ts">
	/** Dependency-free horizontal bar chart for small categorical breakdowns. */
	let {
		data = [],
		unit = ''
	}: { data?: { label: string; value: number }[]; unit?: string } = $props();

	let max = $derived(Math.max(1, ...data.map((d) => d.value)));
</script>

{#if data.length}
	<div class="space-y-3">
		{#each data as item (item.label)}
			<div class="space-y-1">
				<div class="flex items-baseline justify-between text-sm">
					<span class="text-muted-foreground">{item.label}</span>
					<span class="font-medium tabular-nums">{item.value}{unit}</span>
				</div>
				<div class="h-2 w-full overflow-hidden rounded-full bg-muted">
					<div
						class="h-full rounded-full bg-primary transition-[width] duration-500"
						style="width: {(item.value / max) * 100}%"
					></div>
				</div>
			</div>
		{/each}
	</div>
{:else}
	<p class="py-6 text-center text-sm text-muted-foreground">No data yet</p>
{/if}
