<script lang="ts">
	import { Download } from '@lucide/svelte';
	import { env } from '$env/dynamic/public';
	import CopyBlock from '$lib/components/CopyBlock.svelte';
	import * as Card from '$lib/components/ui/card';

	/** The loccibox CLI: prebuilt binaries from the GitHub releases. */

	const REPO = 'MikeTeddyOmondi/locci-box';
	const LATEST = `https://github.com/${REPO}/releases/latest/download`;
	const apiUrl = env.PUBLIC_LOCCI_BOX_API_URL || 'https://api-box.locci.cloud';

	const BINARIES = [
		{ platform: 'Linux', arch: 'x64', file: 'loccibox-linux-x64' },
		{ platform: 'Linux', arch: 'arm64', file: 'loccibox-linux-arm64' },
		{ platform: 'macOS', arch: 'Apple Silicon', file: 'loccibox-macos-arm64' },
		{ platform: 'Windows', arch: 'x64', file: 'loccibox-windows-x64.exe' },
		{ platform: 'Windows', arch: 'arm64', file: 'loccibox-windows-arm64.exe' }
	];
</script>

<svelte:head><title>Downloads · Locci Box</title></svelte:head>

<div class="mx-auto w-full max-w-5xl space-y-6 p-4 lg:p-6">
	<div>
		<h1 class="text-3xl font-bold">Downloads</h1>
		<p class="mt-1 text-muted-foreground">The loccibox CLI: run code, work in boxes, and serve the MCP tools to your AI client.</p>
	</div>

	<Card.Root>
		<Card.Header>
			<Card.Title>Prebuilt binaries</Card.Title>
			<Card.Description>One file, no runtime needed. <a class="underline" href="https://github.com/{REPO}/releases">All releases</a></Card.Description>
		</Card.Header>
		<Card.Content class="grid gap-2 sm:grid-cols-2">
			{#each BINARIES as b (b.file)}
				<a
					href="{LATEST}/{b.file}"
					class="flex items-center justify-between gap-3 rounded-md border px-4 py-3 text-sm hover:bg-accent"
				>
					<span><span class="font-medium">{b.platform}</span> <span class="text-muted-foreground">{b.arch}</span></span>
					<Download class="size-4 text-muted-foreground" />
				</a>
			{/each}
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Install</Card.Title>
			<Card.Description>Linux and macOS</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-3">
			<CopyBlock code={`chmod +x loccibox-linux-x64 && mv loccibox-linux-x64 ~/.local/bin/loccibox\n# macOS: let it run after downloading\nxattr -d com.apple.quarantine loccibox-macos-arm64`} />
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Quick start</Card.Title>
			<Card.Description>With a Locci API key from the API keys page</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-3">
			<CopyBlock
				code={`export LOCCIBOX_API_URL=${apiUrl}\nexport LOCCIBOX_API_KEY=locci_sk_live_...\n\nloccibox run --lang python --code "print('hello from a microVM')"\nloccibox box create --language go     # a box with Go ready\nloccibox mcp config                   # the MCP server entry for your AI client`}
			/>
		</Card.Content>
	</Card.Root>
</div>
