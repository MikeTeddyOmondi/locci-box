<script lang="ts">
	import * as Accordion from '$lib/components/ui/accordion';

	/** Questions people ask, answered from what Locci Box does today. */

	const FAQ = [
		{
			q: 'What is a microVM sandbox?',
			a: 'Each run gets its own small virtual machine (microsandbox, on KVM or Apple Hypervisor), not a container: its own kernel, memory and CPUs. Code inside it cannot reach the host, other runs, or the host\'s networks.'
		},
		{
			q: 'What is the difference between a run and a box?',
			a: 'A run (run_sandbox, the Code and Playground pages) executes one program in a fresh microVM and deletes it. A box is a microVM that keeps running between commands, with apt, git and a toolchain, for an agent or a person to work in; it stops after 15 idle minutes and starts again with its files.'
		},
		{
			q: 'Which languages are supported?',
			a: 'Python, Node.js, Bash, Ruby, Go, Rust, C and C++, each on its latest release. Boxes come per language too, each with that language\'s official image.'
		},
		{
			q: 'Why did a run answer "still downloading"?',
			a: 'The host is fetching that language\'s image for the first time. It takes a minute or two; retry then. Busy hosts fetch an image the first time someone asks for it.'
		},
		{
			q: 'How do I sign in, and what are API keys?',
			a: 'With Locci Auth, the same account as the rest of Locci. API keys are Locci API keys (locci_sk_live_...): create them on the API keys page and use them with the CLI, the MCP server or curl. Revoking one stops it everywhere.'
		},
		{
			q: 'How do I give an AI agent these tools?',
			a: 'Run "loccibox mcp config" and add the printed entry to your MCP client (Claude Code, Claude Desktop, Cursor). The agent gets run_sandbox and the box_* tools.'
		},
		{
			q: 'Can code in a sandbox reach the internet?',
			a: 'Runs reach a short allowlist (package registries). Boxes reach the public internet, with the host\'s own networks, cloud metadata and private ranges blocked.'
		}
	];
</script>

<svelte:head><title>FAQ · Locci Box</title></svelte:head>

<div class="mx-auto w-full max-w-3xl space-y-6 p-4 lg:p-6">
	<div>
		<h1 class="text-3xl font-bold">FAQ</h1>
		<p class="mt-1 text-muted-foreground">How Locci Box works, briefly.</p>
	</div>
	<Accordion.Root type="single">
		{#each FAQ as item (item.q)}
			<Accordion.Item value={item.q}>
				<Accordion.Trigger class="text-left">{item.q}</Accordion.Trigger>
				<Accordion.Content class="text-muted-foreground">{item.a}</Accordion.Content>
			</Accordion.Item>
		{/each}
	</Accordion.Root>
</div>
