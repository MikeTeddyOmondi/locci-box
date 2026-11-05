import { mode } from 'mode-watcher';
import { TERMINAL_THEMES, type TerminalTheme } from './components/BoxTerminal.svelte';

/**
 * The terminal theme for each console mode: Gruvbox Light in light mode and
 * One Dark in dark mode, unless one was picked in that mode. Picks are kept in
 * this browser and shared by every box terminal (the full-page modal and the
 * Code page's panel).
 */

const DEFAULT_THEME = { light: 'gruvbox-light', dark: 'one-dark' } as const satisfies Record<string, TerminalTheme>;
type Mode = keyof typeof DEFAULT_THEME;
const themeKey = (m: Mode) => `locci-box.terminal-theme.${m}`;

class TerminalThemeChoice {
	#picked = $state<Partial<Record<Mode, TerminalTheme>>>({});
	#loaded = false;

	get #mode(): Mode {
		return mode.current === 'light' ? 'light' : 'dark';
	}

	/** The theme for the current mode. Call `load()` once in the browser first. */
	get current(): TerminalTheme {
		return this.#picked[this.#mode] ?? DEFAULT_THEME[this.#mode];
	}

	load() {
		if (this.#loaded) return;
		this.#loaded = true;
		try {
			for (const m of ['light', 'dark'] as const) {
				const saved = localStorage.getItem(themeKey(m));
				if (saved && saved in TERMINAL_THEMES) this.#picked[m] = saved as TerminalTheme;
			}
		} catch {
			// storage blocked: the defaults
		}
	}

	/** Pick a theme for the current mode. */
	set(value: string) {
		if (!(value in TERMINAL_THEMES)) return;
		this.#picked[this.#mode] = value as TerminalTheme;
		try {
			localStorage.setItem(themeKey(this.#mode), value);
		} catch {
			// storage blocked: the choice lasts until reload
		}
	}
}

export const terminalTheme = new TerminalThemeChoice();
