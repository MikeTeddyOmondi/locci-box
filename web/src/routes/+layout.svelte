<script lang="ts">
	import './layout.css';
	import { ModeWatcher } from 'mode-watcher';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import { Toaster } from '$lib/components/ui/sonner';
	import * as Tooltip from '$lib/components/ui/tooltip';

	let { children } = $props();
</script>

<ModeWatcher defaultMode="system" />
<svelte:head>
	<title>Locci Box</title>
	<meta name="description" content="Locci Box runs untrusted code in isolated microVMs, for people and for AI agents." />
</svelte:head>

<!-- Every tooltip (icon buttons, the theme toggle) needs this above it. -->
<Tooltip.Provider delayDuration={300}>
	{@render children()}
</Tooltip.Provider>

<Toaster />
<ConfirmDialog />
