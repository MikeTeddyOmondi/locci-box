<script lang="ts">
	import type { HTMLTdAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: HTMLTdAttributes & { ref?: HTMLTableCellElement | null } = $props();
</script>

<td
	bind:this={ref}
	data-slot="table-cell"
	class={cn('px-3 py-2 align-middle', className)}
	{...restProps}
>
	{@render children?.()}
</td>
