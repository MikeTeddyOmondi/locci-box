<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import {
		BookOpen,
		Boxes,
		Bug,
		FileCode2,
		KeyRound,
		LayoutDashboard,
		LogOut,
		Menu,
		Split,
		X
	} from '@lucide/svelte';
	import Logo from '$lib/components/Logo.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import UserMenu from '$lib/components/UserMenu.svelte';
	import { Button } from '$lib/components/ui/button';
	import { signOut } from '../auth.remote';

	/**
	 * The console shell, after locci-platform's: a sidebar of sections, a top
	 * bar with the theme toggle and the account menu, and the page. Signed-out
	 * visitors are sent to /login by +layout.server.ts.
	 */

	let { data, children } = $props();
	let sidebarOpen = $state(false);

	const NAV = [
		{ href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
		{ href: '/code', label: 'Code', icon: FileCode2 },
		{ href: '/bob', label: 'BOB', icon: Bug },
		{ href: '/playground', label: 'Playground', icon: Split },
		{ href: '/boxes', label: 'Boxes', icon: Boxes },
		{ href: '/keys', label: 'API keys', icon: KeyRound },
		{ href: '/docs', label: 'Docs', icon: BookOpen }
	];

	const isActive = (href: string) => page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);

	async function handleSignOut() {
		await signOut();
		goto('/login', { invalidateAll: true });
	}
</script>

	<div class="flex h-dvh overflow-hidden bg-background text-foreground">
		{#if sidebarOpen}
			<div
				class="fixed inset-0 z-40 bg-black/50 lg:hidden"
				onclick={() => (sidebarOpen = false)}
				onkeydown={(e) => e.key === 'Escape' && (sidebarOpen = false)}
				role="button"
				tabindex="-1"
				aria-label="Close menu"
			></div>
		{/if}

		<aside
			class={[
				'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-sidebar text-sidebar-foreground transition-transform lg:static lg:translate-x-0',
				sidebarOpen ? 'translate-x-0' : '-translate-x-full'
			]}
		>
			<a href="/dashboard" class="flex h-14 items-center gap-2 border-b px-4">
				<Logo class="h-6" />
				<span class="text-sm font-semibold tracking-tight text-muted-foreground">Box</span>
			</a>

			<nav class="flex-1 space-y-1 overflow-y-auto p-3">
				{#each NAV as item (item.href)}
					<a
						href={item.href}
						onclick={() => (sidebarOpen = false)}
						aria-current={isActive(item.href) ? 'page' : undefined}
						class={[
							'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
							isActive(item.href)
								? 'bg-sidebar-accent text-sidebar-accent-foreground'
								: 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
						]}
					>
						<item.icon class="size-4" />
						{item.label}
					</a>
				{/each}
			</nav>

			<div class="border-t p-3">
				<Button variant="ghost" class="w-full justify-start gap-3 text-sidebar-foreground/70" onclick={handleSignOut}>
					<LogOut class="size-4" />
					Sign out
				</Button>
			</div>
		</aside>

		<div class="flex min-w-0 flex-1 flex-col overflow-hidden">
			<header class="flex h-14 shrink-0 items-center gap-4 border-b px-4 lg:px-6">
				<Button
					variant="ghost"
					size="icon"
					class="lg:hidden"
					aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
					onclick={() => (sidebarOpen = !sidebarOpen)}
				>
					{#if sidebarOpen}<X class="size-5" />{:else}<Menu class="size-5" />{/if}
				</Button>
				<div class="flex-1"></div>
				<ThemeToggle />
				<UserMenu email={data.user.email} />
			</header>

			<main class="flex min-h-0 flex-1 flex-col overflow-y-auto">
				{@render children()}
			</main>
		</div>
	</div>
