<script lang="ts" module>
	/** A text file read in the browser and sent to BOB as context. */
	export interface Attachment {
		id: string;
		name: string;
		size: number;
		text: string;
	}

	export interface ComposerSubmit {
		text: string;
		attachments: Attachment[];
	}
</script>

<script lang="ts">
	import { ArrowUp, Paperclip, Square } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import FileChip from './FileChip.svelte';
	import IconButton from './IconButton.svelte';

	/**
	 * BOB's message box, after locci-ai-inference's chat composer: Enter sends,
	 * Shift+Enter adds a line, code files attach as text, and a long paste
	 * becomes an attachment rather than flooding the box.
	 */

	interface Props {
		onSubmit: (input: ComposerSubmit) => void | Promise<void>;
		onStop?: () => void;
		/** A reply is streaming: Send becomes Stop. */
		busy?: boolean;
		disabled?: boolean;
		autofocus?: boolean;
		placeholder?: string;
	}

	const {
		onSubmit,
		onStop,
		busy = false,
		disabled = false,
		autofocus = false,
		placeholder = 'Paste code, or describe the bug'
	}: Props = $props();

	const TEXT_EXTENSIONS =
		'.txt,.md,.json,.yaml,.yml,.toml,.xml,.html,.css,.js,.mjs,.ts,.tsx,.jsx,.svelte,.vue,.py,.go,.rs,.java,.kt,.rb,.php,.c,.h,.cpp,.hpp,.cs,.sh,.sql,.log';
	const MAX_FILES = 5;
	const MAX_FILE_BYTES = 500_000;
	const PASTE_AS_FILE_CHARS = 2_000;
	const PASTE_AS_FILE_LINES = 30;
	const MAX_HEIGHT = 256;

	let text = $state('');
	let attachments = $state<Attachment[]>([]);
	let dragging = $state(false);
	let notice = $state('');
	let textarea: HTMLTextAreaElement | undefined = $state();
	let fileInput: HTMLInputElement | undefined = $state();

	const canSend = $derived(!disabled && !busy && (text.trim().length > 0 || attachments.length > 0));

	$effect(() => {
		if (autofocus && textarea && !disabled) textarea.focus({ preventScroll: true });
	});

	$effect(() => {
		void text;
		if (!textarea) return;
		textarea.style.height = 'auto';
		textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_HEIGHT)}px`;
	});

	function flash(message: string) {
		notice = message;
		setTimeout(() => {
			if (notice === message) notice = '';
		}, 4000);
	}

	/** A long paste (a whole file, a stack trace) becomes a chip. */
	function onPaste(e: ClipboardEvent) {
		const pasted = e.clipboardData?.getData('text/plain') ?? '';
		if (pasted.length < PASTE_AS_FILE_CHARS && pasted.split('\n').length < PASTE_AS_FILE_LINES) return;
		e.preventDefault();
		if (attachments.length >= MAX_FILES) return flash(`Up to ${MAX_FILES} files per message.`);
		const n = attachments.filter((a) => a.name.startsWith('Pasted text')).length + 1;
		attachments.push({
			id: crypto.randomUUID(),
			name: `Pasted text${n > 1 ? ` (${n})` : ''}.txt`,
			size: new Blob([pasted]).size,
			text: pasted
		});
	}

	async function addFiles(list: FileList | File[] | null) {
		if (!list) return;
		for (const file of Array.from(list)) {
			if (attachments.length >= MAX_FILES) {
				flash(`Up to ${MAX_FILES} files per message.`);
				break;
			}
			if (file.size > MAX_FILE_BYTES) {
				flash(`${file.name} is too large (max ${Math.round(MAX_FILE_BYTES / 1000)} KB).`);
				continue;
			}
			attachments.push({ id: crypto.randomUUID(), name: file.name, size: file.size, text: await file.text() });
		}
		if (fileInput) fileInput.value = '';
	}

	async function submit() {
		if (!canSend) return;
		const payload = { text: text.trim(), attachments: [...attachments] };
		text = '';
		attachments = [];
		await onSubmit(payload);
		textarea?.focus({ preventScroll: true });
	}

	function onKeydown(e: KeyboardEvent) {
		// Enter sends, Shift+Enter adds a line; touch keyboards keep Enter as a newline.
		if (e.key !== 'Enter' || e.isComposing) return;
		const touch = window.matchMedia('(pointer: coarse)').matches;
		if (e.metaKey || e.ctrlKey || (!e.shiftKey && !touch)) {
			e.preventDefault();
			submit();
		}
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragging = false;
		if (!disabled) void addFiles(Array.from(e.dataTransfer?.files ?? []));
	}
</script>

<div class="w-full">
	<div
		class={[
			'rounded-[26px] border bg-secondary p-2 shadow-sm transition-shadow focus-within:shadow-md dark:shadow-none',
			dragging && 'border-brand ring-2 ring-brand/30'
		]}
		role="group"
		aria-label="Message composer"
		ondragover={(e) => {
			if (!e.dataTransfer?.types.includes('Files')) return;
			e.preventDefault();
			dragging = true;
		}}
		ondragleave={() => (dragging = false)}
		ondrop={onDrop}
	>
		{#if attachments.length > 0}
			<ul class="flex flex-wrap gap-2 px-1 pt-1 pb-2" aria-label="Attachments">
				{#each attachments as file (file.id)}
					<li class="max-w-full min-w-0 sm:max-w-72">
						<FileChip
							name={file.name}
							size={file.size}
							text={file.text}
							onRemove={() => (attachments = attachments.filter((a) => a.id !== file.id))}
						/>
					</li>
				{/each}
			</ul>
		{/if}

		<div class="flex flex-wrap items-end gap-1">
			<textarea
				bind:this={textarea}
				bind:value={text}
				onkeydown={onKeydown}
				onpaste={onPaste}
				rows="1"
				{placeholder}
				aria-label="Message"
				{disabled}
				class="order-1 max-h-64 min-h-10 basis-full resize-none overflow-y-auto border-0 bg-transparent px-2 py-2 text-base leading-6 text-foreground placeholder:text-muted-foreground focus:ring-0"
			></textarea>

			<div class="order-2 flex items-center gap-1">
				<input
					bind:this={fileInput}
					type="file"
					multiple
					accept={TEXT_EXTENSIONS}
					class="hidden"
					onchange={(e) => addFiles((e.currentTarget as HTMLInputElement).files)}
				/>
				<IconButton side="top" label="Attach code files" onclick={() => fileInput?.click()} {disabled}>
					<Paperclip />
				</IconButton>
			</div>

			<div class="order-3 ml-auto flex items-center gap-1">
				{#if busy}
					<Button size="icon-round" aria-label="Stop generating" onclick={() => onStop?.()}>
						<Square class="size-3.5 fill-current" />
					</Button>
				{:else}
					<Button
						size="icon-round"
						class="bg-brand text-white hover:bg-brand-hover disabled:bg-accent disabled:text-muted-foreground disabled:opacity-100"
						aria-label="Send message"
						disabled={!canSend}
						onclick={submit}
					>
						<ArrowUp />
					</Button>
				{/if}
			</div>
		</div>
	</div>

	<p class="mt-2 min-h-4 px-2 text-center text-xs text-muted-foreground" aria-live="polite">
		{notice || 'BOB can be wrong. Check its fixes before you ship them.'}
	</p>
</div>
