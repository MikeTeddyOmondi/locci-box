<script lang="ts">
	/**
	 * Dependency-free sparkline. Renders an area + line for a series of numbers,
	 * scaled to the component box via a viewBox so it stays responsive.
	 */
	let {
		data = [],
		class: className = '',
		height = 48
	}: { data?: number[]; class?: string; height?: number } = $props();

	const WIDTH = 100;
	const HEIGHT = 32;

	let points = $derived.by(() => {
		if (data.length < 2) return [];
		const max = Math.max(...data);
		const min = Math.min(...data);
		const span = max - min || 1;
		return data.map((value, i) => ({
			x: (i / (data.length - 1)) * WIDTH,
			y: HEIGHT - ((value - min) / span) * HEIGHT
		}));
	});

	let line = $derived(points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' '));
	let area = $derived(points.length ? `0,${HEIGHT} ${line} ${WIDTH},${HEIGHT}` : '');
</script>

{#if points.length}
	<svg
		viewBox="0 0 {WIDTH} {HEIGHT}"
		preserveAspectRatio="none"
		style="height: {height}px"
		class="w-full {className}"
		role="img"
		aria-label="Trend over the last {data.length} points"
	>
		<polygon points={area} class="fill-primary/15" />
		<polyline
			points={line}
			fill="none"
			class="stroke-primary"
			stroke-width="1.5"
			vector-effect="non-scaling-stroke"
			stroke-linejoin="round"
			stroke-linecap="round"
		/>
	</svg>
{:else}
	<div style="height: {height}px" class="flex items-center justify-center {className}">
		<span class="text-xs text-muted-foreground">No data yet</span>
	</div>
{/if}
