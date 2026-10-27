<script lang="ts">
	import { page } from '$app/state';
	import Logo from '$lib/components/Logo.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import { signIn } from '../auth.remote';

	/** Sign in with Locci Auth, as on locci-platform. */

	let loading = $state<'locci' | 'github' | null>(null);
	let failed = $state('');

	const ERRORS: Record<string, string> = {
		no_code: 'No authorization code received',
		no_verifier: 'Session expired, please try again',
		exchange_failed: 'Failed to exchange authorization code'
	};
	const error = $derived(failed || (page.url.searchParams.get('error') ? (ERRORS[page.url.searchParams.get('error')!] ?? page.url.searchParams.get('error')!) : ''));

	async function login(provider?: 'github') {
		loading = provider ?? 'locci';
		failed = '';
		try {
			const { url } = await signIn({ returnTo: page.url.searchParams.get('next') ?? undefined, provider });
			location.href = url;
		} catch {
			failed = 'Failed to start signing in. Please try again.';
			loading = null;
		}
	}
</script>

<svelte:head><title>Sign in · Locci Box</title></svelte:head>

<div class="flex min-h-dvh items-center justify-center bg-background p-4">
	<Card.Root class="w-full max-w-md">
		<Card.Header class="items-center text-center">
			<div class="mb-2 flex justify-center"><Logo class="h-8" /></div>
			<Card.Title class="text-2xl">Locci Box</Card.Title>
			<Card.Description>Isolated microVMs for code, people and AI agents</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-4">
			{#if error}
				<div class="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive" role="alert">
					{error}
				</div>
			{/if}

			<Button class="w-full" size="lg" onclick={() => login()} disabled={loading !== null}>
				{loading === 'locci' ? 'Redirecting...' : 'Sign in with Locci OAuth'}
			</Button>

			<div class="relative">
				<Separator />
				<span class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground uppercase">or</span>
			</div>

			<Button variant="outline" class="w-full" size="lg" onclick={() => login('github')} disabled={loading !== null}>
				{#if loading === 'github'}
					Redirecting...
				{:else}
					<!-- GitHub asks that its own mark be used on sign-in buttons. -->
					<svg class="mr-2 size-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
						<path
							d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z"
						/>
					</svg>
					Continue with GitHub
				{/if}
			</Button>
		</Card.Content>
		<Card.Footer class="justify-center text-sm text-muted-foreground">
			<p>Secure OAuth authentication</p>
		</Card.Footer>
	</Card.Root>
</div>
