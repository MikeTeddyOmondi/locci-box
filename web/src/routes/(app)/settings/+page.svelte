<script lang="ts">
	import { goto } from '$app/navigation';
	import { env } from '$env/dynamic/public';
	import { ExternalLink, LogOut } from '@lucide/svelte';
	import { setMode, userPrefersMode } from 'mode-watcher';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { signOut } from '../../auth.remote';

	let { data } = $props();

	const issuer = env.PUBLIC_OPENAUTH_ISSUER || 'http://localhost:8787';
	const MODES = [
		{ value: 'light', label: 'Light' },
		{ value: 'dark', label: 'Dark' },
		{ value: 'system', label: 'System' }
	] as const;

	async function handleSignOut() {
		await signOut();
		goto('/login', { invalidateAll: true });
	}
</script>

<svelte:head><title>Settings · Locci Box</title></svelte:head>

<div class="mx-auto w-full max-w-3xl space-y-6 p-4 lg:p-6">
	<div>
		<h1 class="text-3xl font-bold">Settings</h1>
		<p class="mt-1 text-muted-foreground">Your account and preferences.</p>
	</div>

	<Card.Root>
		<Card.Header>
			<Card.Title>Account</Card.Title>
			<Card.Description>You sign in with Locci Auth; your profile lives there.</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-4">
			<dl class="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
				<dt class="text-muted-foreground">Email</dt>
				<dd>{data.user.email}</dd>
				<dt class="text-muted-foreground">Locci user</dt>
				<dd class="font-mono text-xs">{data.user.id}</dd>
			</dl>
			<div class="flex flex-wrap gap-2">
				<Button variant="outline" href={issuer} target="_blank" rel="noreferrer">
					Locci Auth <ExternalLink class="size-4" />
				</Button>
				<Button variant="outline" onclick={handleSignOut}><LogOut class="size-4" /> Sign out</Button>
			</div>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Appearance</Card.Title>
		</Card.Header>
		<Card.Content class="flex gap-2">
			{#each MODES as m (m.value)}
				<Button variant={userPrefersMode.current === m.value ? 'default' : 'outline'} onclick={() => setMode(m.value)}>
					{m.label}
				</Button>
			{/each}
		</Card.Content>
	</Card.Root>
</div>
