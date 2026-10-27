<script lang="ts">
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import Sparkline from './Sparkline.svelte';
	import type { Component } from 'svelte';

	let {
		label,
		value,
		hint = '',
		href,
		icon,
		trend = [],
		loading = false
	}: {
		label: string;
		value: string | number;
		hint?: string;
		href?: string;
		icon?: Component<{ class?: string }>;
		trend?: number[];
		loading?: boolean;
	} = $props();

	const Icon = $derived(icon);
</script>

<Card class="transition-colors hover:border-primary/40">
	<CardHeader class="pb-2">
		<div class="flex items-center justify-between">
			<CardTitle class="text-sm font-medium text-muted-foreground">{label}</CardTitle>
			{#if Icon}
				<Icon class="h-4 w-4 text-muted-foreground" />
			{/if}
		</div>
	</CardHeader>
	<CardContent>
		{#if loading}
			<div class="h-8 w-16 animate-pulse rounded bg-muted"></div>
		{:else}
			<div class="text-3xl font-bold tabular-nums">{value}</div>
		{/if}
		{#if hint}
			<p class="mt-1 text-xs text-muted-foreground">{hint}</p>
		{/if}
		<div class="mt-3">
			<Sparkline data={trend} height={40} />
		</div>
		{#if href}
			<a href={href} class="mt-3 inline-block text-xs font-medium text-primary hover:underline">
				View all →
			</a>
		{/if}
	</CardContent>
</Card>
