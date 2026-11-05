<script lang="ts">
	import type { HTMLThAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: HTMLThAttributes & { ref?: HTMLTableCellElement | null } = $props();
</script>

<th
	bind:this={ref}
	data-slot="table-head"
	class={cn(
		'h-10 px-3 text-left align-middle text-xs font-medium whitespace-nowrap text-muted-foreground',
		className
	)}
	{...restProps}
>
	{@render children?.()}
</th>
