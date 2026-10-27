<script lang="ts">
	import { replaceState } from '$app/navigation';
	import { Chat } from '@ai-sdk/svelte';
	import { DefaultChatTransport, type UIMessage } from 'ai';
	import { ArrowDown, Bug, FileSearch, Gauge, RotateCcw, ShieldAlert } from '@lucide/svelte';
	import { tick, untrack } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { errMessage } from '$lib/utils';
	import { createThread, getThreads } from '../../routes/bob.remote';
	import ChatMessage, { ATTACHMENT_RE } from './ChatMessage.svelte';
	import Composer, { type ComposerSubmit } from './Composer.svelte';

	/**
	 * BOB, the code review and debugging assistant, laid out like
	 * locci-ai-inference's chat. Replies stream from the Locci Box API through
	 * this app's /api/bob (which adds the user's token on the server); the API
	 * saves the conversation when a reply ends, so a thread reloads as it was.
	 */

	interface Props {
		threadId?: string | null;
		initialMessages?: UIMessage[];
	}

	const { threadId = null, initialMessages = [] }: Props = $props();

	// A new review has no thread until its first message. Read once: a thread
	// switch remounts this component.
	let currentThreadId = $state<string | null>(untrack(() => threadId));
	let scroller: HTMLDivElement | undefined = $state();
	let atBottom = $state(true);
	let startError = $state('');

	const chat = new Chat({
		messages: untrack(() => initialMessages),
		transport: new DefaultChatTransport({
			api: '/api/bob',
			prepareSendMessagesRequest: ({ messages }) => ({ body: { messages, threadId: currentThreadId } })
		})
	});

	const messages = $derived(chat.messages);
	const isBusy = $derived(chat.status === 'streaming' || chat.status === 'submitted');
	const lastAssistantIndex = $derived(messages.findLastIndex((m) => m.role === 'assistant'));

	// The API saved the reply: the thread moves to the top of the list.
	let previous = chat.status;
	$effect(() => {
		const now = chat.status;
		if ((previous === 'streaming' || previous === 'submitted') && now === 'ready') void getThreads().refresh();
		previous = now;
	});

	async function handleSubmit({ text, attachments }: ComposerSubmit) {
		startError = '';
		if (!currentThreadId) {
			const title = (text || attachments[0]?.name || 'New review').replace(/\s+/g, ' ').slice(0, 60);
			try {
				const thread = await createThread(title);
				currentThreadId = thread.id;
				// Shallow: the URL becomes the thread's while this chat stays mounted.
				replaceState(`/bob/${thread.id}`, {});
			} catch (err) {
				startError = errMessage(err, 'Could not start the review');
				return;
			}
		}
		// Attached files go as extra text parts; ChatMessage shows them as chips.
		const parts = [
			...(text ? [{ type: 'text' as const, text }] : []),
			...attachments.map((a) => ({
				type: 'text' as const,
				text: `<attachment name="${a.name.replaceAll('"', "'")}">\n${a.text}\n</attachment>`
			}))
		];
		chat.sendMessage({ parts });
		await tick();
		scrollToBottom();
	}

	function editMessage(messageId: string, text: string) {
		const original = chat.messages.find((m) => m.id === messageId);
		if (!original) return;
		const attachments = original.parts.filter((p) => p.type === 'text' && ATTACHMENT_RE.test(p.text));
		chat.sendMessage({ parts: [{ type: 'text', text }, ...attachments], messageId });
	}

	function scrollToBottom(behavior: ScrollBehavior = 'smooth') {
		scroller?.scrollTo({ top: scroller.scrollHeight, behavior });
	}

	// Follow the stream while the reader is at the bottom.
	$effect(() => {
		void messages.length;
		const last = messages.at(-1)?.parts.at(-1);
		void (last && 'text' in last ? last.text : '');
		if (atBottom) scrollToBottom('instant');
	});

	const SUGGESTIONS = [
		{ icon: FileSearch, label: 'Review a function for bugs', prompt: 'Review this function for bugs:\n\n' },
		{ icon: ShieldAlert, label: 'Find security issues', prompt: 'Find the security issues in this code:\n\n' },
		{ icon: Bug, label: 'Explain a stack trace', prompt: 'Explain this error and how to fix it:\n\n' },
		{ icon: Gauge, label: 'Make it faster', prompt: 'Where is this code slow, and how would you speed it up?\n\n' }
	];
	let prefill = $state('');
</script>

{#if messages.length === 0}
	<div class="flex min-h-0 flex-1 flex-col justify-center px-4 pb-[8vh]">
		<div class="mb-8 flex flex-col items-center gap-3 text-center">
			<span class="flex size-12 items-center justify-center rounded-2xl bg-brand/10 text-brand"><Bug class="size-6" /></span>
			<h1 class="text-2xl font-semibold tracking-tight sm:text-3xl">What are we debugging?</h1>
			<p class="max-w-md text-sm text-muted-foreground">
				Paste code, an error or a file. BOB reviews it for bugs, security, performance and readability, and shows the fix.
			</p>
		</div>
		<div class="mx-auto w-full max-w-3xl">
			{#key prefill}
				<Composer onSubmit={handleSubmit} autofocus placeholder={prefill || undefined} />
			{/key}
			{#if startError}<p class="mt-2 text-center text-sm text-destructive">{startError}</p>{/if}
		</div>
		<ul class="mx-auto mt-4 grid w-full max-w-3xl gap-1 sm:grid-cols-2">
			{#each SUGGESTIONS as s (s.label)}
				<li>
					<Button
						variant="ghost"
						onclick={() => (prefill = s.prompt.trim())}
						class="h-auto w-full justify-start gap-3 rounded-2xl px-3 py-2.5 text-[15px] font-normal text-muted-foreground hover:bg-secondary hover:text-foreground"
					>
						<s.icon class="size-5" />
						<span class="truncate">{s.label}</span>
					</Button>
				</li>
			{/each}
		</ul>
	</div>
{:else}
	<div class="relative flex min-h-0 flex-1 flex-col">
		<div
			bind:this={scroller}
			onscroll={() => {
				if (scroller) atBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 80;
			}}
			class="min-h-0 flex-1 overflow-y-auto overscroll-contain"
		>
			<div class="mx-auto flex w-full max-w-3xl flex-col gap-7 px-4 pt-6 pb-10">
				{#each messages as message, i (message.id)}
					<ChatMessage
						{message}
						streaming={isBusy && i === messages.length - 1}
						onRegenerate={i === lastAssistantIndex && !isBusy ? () => chat.regenerate() : undefined}
						onEdit={isBusy ? undefined : (text) => editMessage(message.id, text)}
					/>
				{/each}

				{#if chat.status === 'submitted'}
					<p class="flex items-baseline py-1 text-[15px] text-muted-foreground" role="status">
						<span class="shimmer">Reviewing</span>
						<span class="ml-0.5 inline-flex gap-0.75" aria-hidden="true">
							<span class="size-1 animate-typing rounded-full bg-current"></span>
							<span class="size-1 animate-typing rounded-full bg-current [animation-delay:160ms]"></span>
							<span class="size-1 animate-typing rounded-full bg-current [animation-delay:320ms]"></span>
						</span>
					</p>
				{/if}

				{#if chat.error && !isBusy}
					<div
						class="flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-700 dark:text-red-300"
						role="alert"
					>
						<div class="min-w-0 flex-1">
							<p class="font-medium">Couldn't get a response</p>
							<p class="mt-0.5 wrap-break-word opacity-80">{chat.error.message}</p>
						</div>
						<Button variant="destructive" size="sm" class="shrink-0 rounded-full px-3" onclick={() => chat.regenerate()}>
							<RotateCcw /> Retry
						</Button>
					</div>
				{/if}
			</div>
		</div>

		{#if !atBottom}
			<Button
				variant="outline"
				size="icon-round"
				class="absolute bottom-36 left-1/2 z-10 -translate-x-1/2 shadow-md"
				aria-label="Scroll to latest"
				onclick={() => scrollToBottom()}
			>
				<ArrowDown class="size-4" />
			</Button>
		{/if}

		<div class="shrink-0 bg-background px-3 pt-1 pb-3 sm:px-4">
			<div class="mx-auto w-full max-w-3xl">
				<Composer onSubmit={handleSubmit} onStop={() => chat.stop()} busy={isBusy} />
			</div>
		</div>
	</div>
{/if}
