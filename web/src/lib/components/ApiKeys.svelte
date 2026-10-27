<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { env } from '$env/dynamic/public';
	import { KeyRound, Copy, Check, Plus, TriangleAlert } from '@lucide/svelte';

	import { Button } from '$lib/components/ui/button';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Badge } from '$lib/components/ui/badge';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow
	} from '$lib/components/ui/table';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import CopyBlock from '$lib/components/CopyBlock.svelte';
	import { confirmDialog } from '$lib/confirm.svelte';
	import { errMessage } from '$lib/utils';
	import { getApiKeys, createApiKey, revokeApiKey } from '../../routes/keys.remote';

	const issuer = env.PUBLIC_OPENAUTH_ISSUER || 'http://localhost:8787';
	const apiUrl = env.PUBLIC_LOCCI_BOX_API_URL || 'https://api-box.locci.cloud';

	/**
	 * API keys for reaching Locci without a browser.
	 *
	 * A key is exchanged with the auth service for a short-lived token, so
	 * scripts authenticate the same way the console does and every other service
	 * is unchanged.
	 */

	const keysQuery = getApiKeys();

	let creating = $state(false);
	let busy = $state(false);
	let name = $state('');
	let expiry = $state('90');

	/**
	 * The new key, held only long enough to show it.
	 *
	 * There is no way to see it again (only a hash is stored), so the dialog
	 * says so rather than leaving it to be discovered.
	 */
	let issued = $state<string | null>(null);
	let copied = $state(false);

	const EXPIRY_OPTIONS = [
		{ value: '30', label: '30 days' },
		{ value: '90', label: '90 days' },
		{ value: '365', label: '1 year' },
		{ value: 'never', label: 'Never expires' }
	];

	const expiryLabel = $derived(
		EXPIRY_OPTIONS.find((option) => option.value === expiry)?.label ?? '90 days'
	);

	async function create() {
		if (!name.trim()) return;
		busy = true;
		try {
			const result = await createApiKey({
				name: name.trim(),
				expiresInDays: expiry === 'never' ? null : (Number(expiry) as 30 | 90 | 365)
			});
			issued = result.key;
			name = '';
			expiry = '90';
			creating = false;
		} catch (err) {
			toast.error(errMessage(err, 'Could not create the key'));
		} finally {
			busy = false;
		}
	}

	async function copy() {
		if (!issued) return;
		try {
			await navigator.clipboard.writeText(issued);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			toast.error('Could not copy to the clipboard');
		}
	}

	async function revoke(id: string, label: string) {
		const ok = await confirmDialog({
			title: `Revoke ${label}?`,
			description:
				'Anything still using this key stops working immediately. This cannot be undone: issue a new key instead.',
			confirmLabel: 'Revoke',
			destructive: true
		});
		if (!ok) return;

		try {
			await revokeApiKey(id);
			toast.success(`Revoked ${label}`);
		} catch (err) {
			toast.error(errMessage(err, 'Could not revoke the key'));
		}
	}

	function formatDate(iso: string | null) {
		if (!iso) return null;
		return new Date(iso).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}
</script>

<Card>
	<CardHeader>
		<CardTitle>API keys</CardTitle>
		<CardDescription>
			For reaching Locci from CI or a script. A key is exchanged for a short-lived token, so
			it works anywhere a signed-in session does.
		</CardDescription>
	</CardHeader>
	<CardContent class="space-y-4">
		{#if keysQuery.error}
			<p class="text-sm text-destructive">
				{errMessage(keysQuery.error, 'Could not load your keys')}
			</p>
		{:else if keysQuery.current === undefined}
			<Skeleton class="h-32 w-full" />
		{:else if keysQuery.current.length === 0}
			<div class="rounded-lg border border-dashed p-6 text-center">
				<KeyRound class="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
				<p class="font-medium">No API keys yet</p>
				<p class="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
					A key acts as you. Create one per place that uses it, so a single one can be
					revoked without disturbing the rest.
				</p>
			</div>
		{:else}
			<div class="overflow-x-auto">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Name</TableHead>
							<TableHead>Key</TableHead>
							<TableHead>Last used</TableHead>
							<TableHead>Expires</TableHead>
							<TableHead class="text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{#each keysQuery.current as key (key.id)}
							<TableRow>
								<TableCell class="font-medium">{key.name}</TableCell>
								<TableCell class="font-mono text-xs text-muted-foreground">
									{key.prefix}…
								</TableCell>
								<TableCell class="text-sm text-muted-foreground">
									{formatDate(key.lastUsedAt) ?? 'never'}
								</TableCell>
								<TableCell class="text-sm">
									{#if key.expiresAt}
										{formatDate(key.expiresAt)}
									{:else}
										<Badge variant="outline" class="font-normal">never</Badge>
									{/if}
								</TableCell>
								<TableCell class="text-right">
									<Button
										variant="ghost"
										size="sm"
										class="text-destructive hover:bg-destructive/10 hover:text-destructive"
										onclick={() => revoke(key.id, key.name)}
									>
										Revoke
									</Button>
								</TableCell>
							</TableRow>
						{/each}
					</TableBody>
				</Table>
			</div>
		{/if}

		<Button variant="outline" onclick={() => (creating = true)}>
			<Plus class="mr-2 h-4 w-4" /> Create API key
		</Button>
	</CardContent>
</Card>

<Card class="mt-6">
	<CardHeader>
		<CardTitle>Using a key</CardTitle>
		<CardDescription>Locci Box takes the key itself; other Locci services take a token traded for it</CardDescription>
	</CardHeader>
	<CardContent class="space-y-3">
		<CopyBlock
			code={`curl -X POST ${apiUrl}/api/sandbox/run \\\n  -H "Authorization: Bearer $LOCCI_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"language": "python", "code": "print(42)"}'\n\nloccibox mcp config      # the MCP server reads LOCCIBOX_API_KEY`}
		/>
		<CopyBlock code={`TOKEN=$(curl -s -X POST ${issuer}/keys/token \\\n  -H "x-locci-api-key: $LOCCI_API_KEY" | jq -r .token)`} />
		<p class="text-sm text-muted-foreground">
			A traded token lasts five minutes, so trade once per run rather than storing it. Keep the key
			itself in your CI secret store, never in the repository.
		</p>
	</CardContent>
</Card>

<Dialog bind:open={creating}>
	<DialogContent>
		<DialogHeader>
			<DialogTitle>Create an API key</DialogTitle>
			<DialogDescription>
				It acts as you. One key per place that uses it means a single one can be revoked
				without disturbing the rest.
			</DialogDescription>
		</DialogHeader>

		<div class="space-y-4">
			<div class="space-y-2">
				<Label for="key-name">Name</Label>
				<Input id="key-name" placeholder="CI, laptop, deploy-bot" bind:value={name} />
			</div>
			<div class="space-y-2">
				<Label for="key-expiry">Expires</Label>
				<Select type="single" bind:value={expiry}>
					<SelectTrigger id="key-expiry" class="w-full">{expiryLabel}</SelectTrigger>
					<SelectContent>
						{#each EXPIRY_OPTIONS as option (option.value)}
							<SelectItem value={option.value} label={option.label} />
						{/each}
					</SelectContent>
				</Select>
			</div>
		</div>

		<DialogFooter>
			<Button variant="outline" onclick={() => (creating = false)} disabled={busy}>Cancel</Button>
			<Button onclick={create} disabled={busy || !name.trim()}>
				{busy ? 'Creating…' : 'Create key'}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>

<!-- Shown once. Only a hash is stored, so nothing can reveal this again. -->
<Dialog
	open={issued !== null}
	onOpenChange={(open) => {
		if (!open) issued = null;
	}}
>
	<DialogContent>
		<DialogHeader>
			<DialogTitle>Copy your key now</DialogTitle>
			<DialogDescription>
				This is the only time it is shown. Locci stores only a hash, so it cannot be
				retrieved later; if it is lost, revoke it and create another.
			</DialogDescription>
		</DialogHeader>

		<div class="flex items-center gap-2">
			<Input readonly value={issued ?? ''} class="font-mono text-xs" />
			<Button variant="outline" size="icon" onclick={copy} title="Copy" aria-label="Copy key">
				{#if copied}
					<Check class="h-4 w-4" />
				{:else}
					<Copy class="h-4 w-4" />
				{/if}
			</Button>
		</div>

		<div
			class="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
		>
			<TriangleAlert class="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
			<span>Treat it like a password. Anything holding it can act as you.</span>
		</div>

		<DialogFooter>
			<Button onclick={() => (issued = null)}>Done</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
