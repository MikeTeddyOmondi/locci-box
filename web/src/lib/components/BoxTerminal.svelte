<script lang="ts">
	import { GhosttyCore } from '@wterm/ghostty';
	import ghosttyWasmUrl from '@wterm/ghostty/ghostty-vt.wasm?url';
	import { Terminal, type TerminalHandle } from '@wterm/svelte';
	import '@wterm/svelte/css';
	import { onMount } from 'svelte';
	import { terminalSession } from '../../routes/boxes.remote';
	import { errMessage } from '$lib/utils';

	/**
	 * A login shell in a box over the API's terminal websocket, after
	 * iaas-service's vm-terminal.svelte (the same protocol):
	 *   server -> client  {"type":"stdout","data":<base64 bytes>}, {"type":"exit","code":n}
	 *   client -> server  {"type":"stdin","data":<base64 bytes>}
	 *                     {"type":"resize","width":cols,"height":rows}
	 *
	 * Bytes are base64 encoded as UTF-8, not Latin-1: plain btoa/atob would mangle
	 * anything outside ISO-8859-1 (accents, box drawing, emoji).
	 */

	let { boxId, onClose }: { boxId: string; onClose?: () => void } = $props();

	let core = $state<GhosttyCore | null>(null);
	let term = $state<TerminalHandle>();
	let status = $state<'loading' | 'connecting' | 'open' | 'closed' | 'error'>('loading');
	let socket: WebSocket | undefined;
	let size = { cols: 0, rows: 0 };

	const encoder = new TextEncoder();

	function toBase64(bytes: Uint8Array): string {
		let binary = '';
		for (const byte of bytes) binary += String.fromCharCode(byte);
		return btoa(binary);
	}

	function fromBase64(data: string): Uint8Array {
		return Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
	}

	function send(message: Record<string, unknown>) {
		if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
	}

	function sendResize() {
		if (size.cols > 0 && size.rows > 0) send({ type: 'resize', width: size.cols, height: size.rows });
	}

	async function connect() {
		status = 'connecting';
		let url: string;
		try {
			({ url } = await terminalSession(boxId));
		} catch (err) {
			status = 'error';
			term?.write(`\r\n\x1b[31m${errMessage(err, 'Could not start a terminal session.')}\x1b[0m\r\n`);
			onClose?.();
			return;
		}

		socket = new WebSocket(url);
		socket.binaryType = 'arraybuffer';

		socket.onopen = () => {
			status = 'open';
			// The shell starts at a default size; tell it the real one straight away.
			sendResize();
			term?.focus();
		};

		socket.onmessage = (event) => {
			const text = typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data);
			try {
				const msg = JSON.parse(text) as { type?: string; data?: string; code?: number };
				if (msg.type === 'stdout' && msg.data) term?.write(fromBase64(msg.data));
				if (msg.type === 'exit') term?.write(`\r\n\x1b[90m[shell exited with ${msg.code}]\x1b[0m`);
			} catch {
				term?.write(text);
			}
		};

		socket.onerror = () => {
			status = 'error';
		};

		socket.onclose = () => {
			if (status !== 'error') status = 'closed';
			term?.write('\r\n\x1b[90m[session closed]\x1b[0m\r\n');
			onClose?.();
		};
	}

	/**
	 * Scrollback budget in BYTES (Ghostty stores full cells, allocated in pages).
	 * iaas-service measured the package default at ~270 rows of a 175-column
	 * terminal; 16 MiB keeps several thousand wide rows for one session.
	 */
	const SCROLLBACK_BYTES = 16 * 1024 * 1024;

	onMount(() => {
		void GhosttyCore.load({ wasmPath: ghosttyWasmUrl, scrollbackLimit: SCROLLBACK_BYTES }).then((loaded) => {
			core = loaded;
		});
		return () => {
			socket?.close();
			socket = undefined;
		};
	});

	function handleResize(cols: number, rows: number) {
		size = { cols, rows };
		sendResize();
	}
</script>

{#if !core}
	<div class="flex h-full min-h-[300px] w-full items-center justify-center bg-black">
		<span class="text-sm text-zinc-500">Loading the terminal...</span>
	</div>
{:else}
	<div class="relative h-full w-full overflow-hidden" style="isolation: isolate">
		<Terminal
			bind:this={term}
			{core}
			theme="solarized-dark"
			cursorBlink
			autoResize
			class="h-full w-full"
			onReady={() => void connect()}
			onData={(data: string) => send({ type: 'stdin', data: toBase64(encoder.encode(data)) })}
			onBinary={(data: Uint8Array) => send({ type: 'stdin', data: toBase64(data) })}
			onResize={handleResize}
		/>
		{#if status === 'connecting'}
			<span class="absolute top-2 right-3 text-xs text-zinc-500">Connecting (a stopped box starts first)...</span>
		{:else if status === 'error'}
			<span class="absolute top-2 right-3 text-xs text-destructive">Connection failed</span>
		{/if}
	</div>
{/if}
