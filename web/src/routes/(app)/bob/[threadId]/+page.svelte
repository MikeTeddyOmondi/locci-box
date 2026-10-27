<script lang="ts">
	import { page } from '$app/state';
	import BobChat from '$lib/components/BobChat.svelte';
	import { errMessage } from '$lib/utils';
	import { getThreadMessages } from '../../../bob.remote';

	const id = $derived((page.params as { threadId: string }).threadId);
</script>

{#key id}
	{#await getThreadMessages(id)}
		<div class="flex flex-1 items-center justify-center">
			<p class="shimmer text-sm text-muted-foreground" role="status">Loading the review...</p>
		</div>
	{:then messages}
		<BobChat threadId={id} initialMessages={messages} />
	{:catch err}
		<div class="flex flex-1 items-center justify-center">
			<p class="text-sm text-muted-foreground">{errMessage(err, 'This review could not be loaded')}</p>
		</div>
	{/await}
{/key}
