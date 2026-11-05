<script lang="ts">
	import { goto } from '$app/navigation';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { CircleHelp, Download, KeyRound, LogOut, Settings } from '@lucide/svelte';
	import { signOut } from '../../routes/auth.remote';

	/**
	 * The signed-in user's menu in the top bar (after locci-platform's): an
	 * avatar with the email's first letter; the address itself is inside.
	 */

	let { email = '' }: { email?: string } = $props();

	const initial = $derived(email.trim()[0]?.toUpperCase() ?? '·');

	const LINKS = [
		{ href: '/settings', label: 'Settings', icon: Settings },
		{ href: '/keys', label: 'API keys', icon: KeyRound },
		{ href: '/downloads', label: 'Downloads', icon: Download },
		{ href: '/faq', label: 'FAQ', icon: CircleHelp }
	];

	async function handleSignOut() {
		await signOut();
		goto('/login', { invalidateAll: true });
	}
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<button
				{...props}
				type="button"
				aria-label="Account menu"
				class="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
			>
				{initial}
			</button>
		{/snippet}
	</DropdownMenu.Trigger>

	<DropdownMenu.Content align="end" class="w-56">
		{#if email}
			<div class="px-2 py-1.5">
				<p class="text-xs text-muted-foreground">Signed in as</p>
				<p class="truncate text-sm font-medium" title={email}>{email}</p>
			</div>
			<DropdownMenu.Separator />
		{/if}
		{#each LINKS as link (link.href)}
			<DropdownMenu.Item>
				{#snippet child({ props })}
					<a {...props} href={link.href}>
						<link.icon class="size-4" />
						{link.label}
					</a>
				{/snippet}
			</DropdownMenu.Item>
		{/each}
		<DropdownMenu.Separator />
		<DropdownMenu.Item onclick={handleSignOut}>
			<LogOut class="size-4" />
			Sign out
		</DropdownMenu.Item>
	</DropdownMenu.Content>
</DropdownMenu.Root>
