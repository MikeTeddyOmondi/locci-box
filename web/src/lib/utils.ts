import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge class lists, letting later Tailwind classes win over earlier ones. */
export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// Prop helpers used by the shadcn-svelte components in $lib/components/ui.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, 'child'> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, 'children'> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };

/** A readable message from a thrown value (remote functions throw `{body: {message}}`). */
export function errMessage(err: unknown, fallback = 'Something went wrong'): string {
	if (typeof err === 'string') return err;
	const e = err as { body?: { message?: string }; message?: string };
	return e?.body?.message || e?.message || fallback;
}

export function formatDate(value: string | Date | undefined | null): string {
	if (!value) return 'never';
	const date = typeof value === 'string' ? new Date(value) : value;
	return Number.isNaN(date.getTime()) ? 'never' : date.toLocaleString();
}
