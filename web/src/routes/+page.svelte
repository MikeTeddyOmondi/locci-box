<script lang="ts">
	import { ArrowRight, Bot, Boxes, Download, Shield, Terminal } from '@lucide/svelte';
	import { env } from '$env/dynamic/public';
	import CopyBlock from '$lib/components/CopyBlock.svelte';
	import Logo from '$lib/components/Logo.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import { Button } from '$lib/components/ui/button';

	/**
	 * The landing page for signed-out visitors, after the React console's
	 * (main's web/src/routes/index.tsx): hero, three features, the CLI, footer.
	 * Console pages all need sign-in, so this one stands alone.
	 */

	const REPO = 'MikeTeddyOmondi/locci-box';
	const LATEST = `https://github.com/${REPO}/releases/latest/download`;
	const apiUrl = env.PUBLIC_LOCCI_BOX_API_URL || 'https://api-box.locci.cloud';

	const FEATURES = [
		{
			Icon: Boxes,
			title: 'Agent boxes',
			text: 'Long-lived microVMs with a persistent /workspace. Install packages, run servers, open a terminal or the code editor, and pick up where you left off: an idle box stops and comes back with its disk as it was.'
		},
		{
			Icon: Shield,
			title: 'Hardware isolation',
			text: 'Every box and every run gets its own microVM and kernel, not a shared container. Untrusted code stays away from the host and from other users, and its network cannot reach the host network.'
		},
		{
			Icon: Bot,
			title: 'Built for AI agents',
			text: 'MCP tools (box_create, box_exec, box_write_file, box_read_file) let Claude and other AI clients work in a box of their own. One-off runs in Python, Node, Go, Rust, C, C++, Ruby and Bash.'
		}
	];

	const BINARIES = [
		{ platform: 'Linux', arch: 'x64', file: 'loccibox-linux-x64' },
		{ platform: 'Linux', arch: 'arm64', file: 'loccibox-linux-arm64' },
		{ platform: 'macOS', arch: 'Apple Silicon', file: 'loccibox-macos-arm64' },
		{ platform: 'Windows', arch: 'x64', file: 'loccibox-windows-x64.exe' },
		{ platform: 'Windows', arch: 'arm64', file: 'loccibox-windows-arm64.exe' }
	];

	const docker = `docker run --rm \\
  -e LOCCIBOX_API_URL=${apiUrl} \\
  -e LOCCIBOX_API_KEY=locci_sk_live_... \\
  locci/box-cli:latest run --lang python --code "print('hello from a microVM')"`;
</script>

<svelte:head>
	<title>Locci Box · Every agent deserves its own computer</title>
	<meta name="description" content="Isolated microVMs for code, people and AI agents: persistent agent boxes, MCP tools and one-off runs in eight languages." />
</svelte:head>

<div class="min-h-dvh bg-sidebar">
	<div class="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6">
		<header class="flex h-14 items-center justify-between rounded-xl border bg-background px-4 sm:h-16 sm:px-6">
			<a href="/" class="flex items-center gap-2" aria-label="Locci Box">
				<Logo class="h-6 sm:h-7" />
				<span class="text-lg font-semibold tracking-tight text-muted-foreground sm:text-xl">Box</span>
			</a>
			<div class="flex items-center gap-1 sm:gap-2">
				<ThemeToggle />
				<Button variant="ghost" href="/login">Sign in</Button>
				<Button href="/login" class="hidden sm:inline-flex">Get started</Button>
			</div>
		</header>

		<section class="grid items-center gap-10 rounded-2xl border bg-background px-6 py-12 sm:px-10 sm:py-16 lg:grid-cols-2 lg:px-14 lg:py-20">
			<div class="space-y-6">
				<span class="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
					<span class="size-1.5 rounded-full bg-brand"></span>
					Agent boxes are here
				</span>
				<h1 class="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">Every agent deserves its own computer</h1>
				<p class="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
					Hardware-isolated microVMs for safe code execution. Give people and AI agents a real Linux machine in seconds, and keep untrusted code far from yours.
				</p>
				<div class="flex flex-wrap gap-3">
					<Button size="lg" href="/login" class="bg-brand text-white hover:bg-brand-hover">
						Get started <ArrowRight class="size-4" />
					</Button>
					<Button size="lg" variant="outline" href="https://github.com/{REPO}">
						<!-- GitHub's own mark, as on the sign-in page (Lucide has no brand icons). -->
						<svg class="size-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
							<path
								d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z"
							/>
						</svg>
						GitHub
					</Button>
				</div>
				<p class="text-sm text-muted-foreground">
					Already have an account? <a href="/login" class="font-medium text-foreground underline underline-offset-4">Sign in</a>
				</p>
			</div>

			<!-- A box at work, as a terminal: what the product is in one picture. -->
			<div class="overflow-hidden rounded-xl border bg-[#0b0b0c] font-mono text-xs leading-relaxed text-zinc-300 shadow-sm sm:text-sm" aria-hidden="true">
				<div class="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
					<span class="size-2.5 rounded-full bg-zinc-600"></span>
					<span class="size-2.5 rounded-full bg-zinc-600"></span>
					<span class="size-2.5 rounded-full bg-zinc-600"></span>
					<span class="ml-2 text-zinc-500">box_7Qm2 /workspace</span>
				</div>
				<pre class="overflow-x-auto p-4"><span class="text-zinc-500">$</span> loccibox box create --language node
<span class="text-emerald-400">created</span> box_7Qm2 (node, 1 GB, 2 vCPU)
<span class="text-zinc-500">$</span> npm init -y &amp;&amp; npm i express
added 66 packages in 3s
<span class="text-zinc-500">$</span> node server.js
<span class="text-sky-400">listening on :3000</span></pre>
			</div>
		</section>

		<section class="grid gap-4 md:grid-cols-3">
			{#each FEATURES as { Icon, title, text } (title)}
				<div class="rounded-2xl border bg-background p-6 sm:p-8">
					<div class="mb-5 flex size-11 items-center justify-center rounded-xl border bg-muted">
						<Icon class="size-5 text-brand" />
					</div>
					<h2 class="mb-2 text-lg font-semibold">{title}</h2>
					<p class="text-sm leading-relaxed text-muted-foreground">{text}</p>
				</div>
			{/each}
		</section>

		<section class="space-y-6 rounded-2xl border bg-background p-6 sm:p-8">
			<div class="flex items-center gap-3">
				<div class="flex size-10 shrink-0 items-center justify-center rounded-xl border bg-muted">
					<Terminal class="size-5 text-brand" />
				</div>
				<div>
					<h2 class="text-xl font-semibold">Get the CLI</h2>
					<p class="text-sm text-muted-foreground">Run code, work in boxes and serve the MCP tools from your terminal</p>
				</div>
			</div>

			<CopyBlock code={docker} label="Copy the Docker command" />

			<div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
				{#each BINARIES as b (b.file)}
					<a href="{LATEST}/{b.file}" class="flex items-center justify-between gap-3 rounded-md border px-4 py-3 text-sm hover:bg-accent">
						<span><span class="font-medium">{b.platform}</span> <span class="text-muted-foreground">{b.arch}</span></span>
						<Download class="size-4 text-muted-foreground" />
					</a>
				{/each}
			</div>
			<p class="text-sm text-muted-foreground">
				Create an API key in the console after signing in. <a href="https://github.com/{REPO}/releases" class="underline underline-offset-4">All releases</a>
			</p>
		</section>

		<footer class="flex flex-col items-center justify-between gap-4 rounded-2xl border bg-background px-6 py-6 text-sm text-muted-foreground sm:flex-row sm:px-8">
			<div class="flex items-center gap-2">
				<Logo class="h-5" />
				<span class="font-medium text-foreground">Box</span>
				<span>© {new Date().getFullYear()} Locci Cloud</span>
			</div>
			<nav class="flex items-center gap-6">
				<a href="https://github.com/{REPO}" class="hover:text-foreground">GitHub</a>
				<a href="https://github.com/{REPO}/releases" class="hover:text-foreground">Releases</a>
				<a href="/login" class="hover:text-foreground">Sign in</a>
			</nav>
		</footer>
	</div>
</div>
