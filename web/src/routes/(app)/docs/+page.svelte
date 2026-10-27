<script lang="ts">
	import { env } from '$env/dynamic/public';
	import CopyBlock from '$lib/components/CopyBlock.svelte';
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';

	/** The Locci Box API, for scripts and agents. */

	const api = env.PUBLIC_LOCCI_BOX_API_URL || 'https://api-box.locci.cloud';

	const SECTIONS = [
		{ id: 'auth', title: 'Authentication' },
		{ id: 'runs', title: 'Run code' },
		{ id: 'boxes', title: 'Agent boxes' },
		{ id: 'mcp', title: 'MCP tools' },
		{ id: 'errors', title: 'Errors' }
	];

	const BOX_ROUTES = [
		{ method: 'POST', path: '/api/boxes', body: '{language?, box_id?}', what: 'Create a box (201), or start and reattach to one (200)' },
		{ method: 'GET', path: '/api/boxes', body: '', what: 'Your boxes, running and stopped' },
		{ method: 'POST', path: '/api/boxes/:id/exec', body: '{command, timeout?}', what: 'sh -c in /workspace; timeout in seconds (default 120, max 600)' },
		{ method: 'PUT', path: '/api/boxes/:id/files', body: '{path, content, encoding?}', what: 'Write a file (up to 5 MB)' },
		{ method: 'GET', path: '/api/boxes/:id/files?path=', body: '', what: 'Read a file (up to 1 MB)' },
		{ method: 'POST', path: '/api/boxes/:id/stop', body: '', what: 'Stop it, keeping its disk' },
		{ method: 'DELETE', path: '/api/boxes/:id', body: '', what: 'Delete the box and its /workspace' }
	];
</script>

<svelte:head><title>Docs · Locci Box</title></svelte:head>

<div class="mx-auto flex w-full max-w-6xl gap-8 p-4 lg:p-6">
	<nav class="sticky top-0 hidden w-44 shrink-0 self-start lg:block" aria-label="On this page">
		<p class="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">On this page</p>
		<ul class="space-y-1 text-sm">
			{#each SECTIONS as s (s.id)}
				<li><a href="#{s.id}" class="text-muted-foreground hover:text-foreground">{s.title}</a></li>
			{/each}
		</ul>
	</nav>

	<div class="min-w-0 flex-1 space-y-8">
		<div>
			<h1 class="text-3xl font-bold">Docs</h1>
			<p class="mt-1 text-muted-foreground">The Locci Box API at <span class="font-mono">{api}</span>.</p>
		</div>

		<section id="auth" class="scroll-mt-4 space-y-3">
			<h2 class="text-xl font-semibold">Authentication</h2>
			<p class="text-sm text-muted-foreground">
				Send a Locci API key (from <a class="underline" href="/keys">API keys</a>) as a bearer token. The API checks it
				with Locci Auth, so a revoked key stops working everywhere. A Locci Auth access token works the same way.
			</p>
			<CopyBlock code={`curl ${api}/api/boxes -H "Authorization: Bearer $LOCCI_API_KEY"`} />
		</section>

		<section id="runs" class="scroll-mt-4 space-y-3">
			<h2 class="text-xl font-semibold">Run code</h2>
			<p class="text-sm text-muted-foreground">
				One program in a fresh microVM, deleted afterwards. Languages: python, node, bash, ruby, go, rust, c, cpp. For Go,
				Rust, C and C++ send a complete program (with main).
			</p>
			<CopyBlock
				code={`curl -X POST ${api}/api/sandbox/run \\\n  -H "Authorization: Bearer $LOCCI_API_KEY" -H "Content-Type: application/json" \\\n  -d '{"language": "python", "code": "print(6 * 7)", "timeout": 30}'`}
			/>
			<CopyBlock
				code={`{ "success": true, "data": { "sandbox_id": "sbox_...", "status": "completed",\n  "stdout": "42\\n", "stderr": "", "exit_code": 0, "duration_ms": 3612 } }`}
				lang="json"
				label="Copy response"
			/>
		</section>

		<section id="boxes" class="scroll-mt-4 space-y-3">
			<h2 class="text-xl font-semibold">Agent boxes</h2>
			<p class="text-sm text-muted-foreground">
				A microVM that keeps running between calls: Debian with apt, git and the toolchain of the language asked for, 1 GB
				and 2 vCPUs, work in /workspace. It stops after 15 idle minutes and starts again under the same id with its files.
			</p>
			<Card.Root>
				<Card.Content class="overflow-x-auto pt-6">
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head>Method</Table.Head>
								<Table.Head>Path</Table.Head>
								<Table.Head>Body</Table.Head>
								<Table.Head>What it does</Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each BOX_ROUTES as r (r.method + r.path)}
								<Table.Row>
									<Table.Cell class="font-mono text-xs">{r.method}</Table.Cell>
									<Table.Cell class="font-mono text-xs">{r.path}</Table.Cell>
									<Table.Cell class="font-mono text-xs">{r.body}</Table.Cell>
									<Table.Cell class="text-sm">{r.what}</Table.Cell>
								</Table.Row>
							{/each}
						</Table.Body>
					</Table.Root>
				</Card.Content>
			</Card.Root>
		</section>

		<section id="mcp" class="scroll-mt-4 space-y-3">
			<h2 class="text-xl font-semibold">MCP tools</h2>
			<p class="text-sm text-muted-foreground">
				The CLI serves the same operations to AI clients over MCP: run_sandbox, get_sandbox_status, stop_sandbox,
				box_create, box_exec, box_write_file, box_read_file, box_stop and box_list.
			</p>
			<CopyBlock code={`claude mcp add LocciBox -e LOCCIBOX_API_URL=${api} -e LOCCIBOX_API_KEY=$LOCCI_API_KEY -- loccibox mcp start`} />
		</section>

		<section id="errors" class="scroll-mt-4 space-y-3">
			<h2 class="text-xl font-semibold">Errors</h2>
			<p class="text-sm text-muted-foreground">
				Failures answer <span class="font-mono">{'{"success": false, "error": "..."}'}</span>. 401: the key or token is
				not valid. 429: too many sandboxes at once. 503: the language's image is still downloading on the host, or Locci
				Auth could not be reached to check the key; retry in a minute.
			</p>
		</section>
	</div>
</div>
