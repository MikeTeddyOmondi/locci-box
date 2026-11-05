<script lang="ts">
	import ApiKeys from '$lib/components/ApiKeys.svelte';
</script>

<svelte:head><title>API keys · Locci Box</title></svelte:head>

<div class="mx-auto w-full max-w-5xl p-4 lg:p-6">
	<div class="mb-6">
		<h1 class="text-3xl font-bold">API keys</h1>
		<p class="mt-1 text-muted-foreground">
			Locci API keys, for the CLI, the MCP server and your scripts. The same keys work on every Locci service.
		</p>
	</div>
	<ApiKeys />
</div>
