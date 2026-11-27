/**
 * Promise-based confirmation, so a shadcn-svelte AlertDialog can stand in for
 * the browser's `confirm()` without restructuring the code around it.
 *
 * A call site keeps its shape:
 *
 *     if (!(await confirmDialog({ title: 'Delete this bucket?' }))) return;
 *
 * One dialog is mounted app-wide (see `ConfirmDialog.svelte` in the root
 * layout, next to `<Toaster />`), the same way sonner works, rather than every
 * page repeating the markup and carrying its own `open`/`pending` state.
 */

export interface ConfirmOptions {
  title: string;
  description?: string;
  /** Label on the confirming button. Say what it does: "Delete", "Revoke". */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Renders the confirm button in the destructive style. */
  destructive?: boolean;
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

/**
 * Held in an object because a module cannot export a reassigned `$state` `let`.
 */
export const confirmState = $state<{ pending: PendingConfirm | null }>({ pending: null });

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  // A second request while one is open would strand the first promise, so
  // settle it as declined before taking over.
  settleConfirm(false);
  return new Promise<boolean>((resolve) => {
    confirmState.pending = { ...options, resolve };
  });
}

/**
 * Resolve the open request, once.
 *
 * Clearing `pending` first makes this idempotent: confirming closes the dialog,
 * and that close fires `onOpenChange(false)`, which calls in here again.
 */
export function settleConfirm(confirmed: boolean): void {
  const pending = confirmState.pending;
  if (!pending) return;
  confirmState.pending = null;
  pending.resolve(confirmed);
}
