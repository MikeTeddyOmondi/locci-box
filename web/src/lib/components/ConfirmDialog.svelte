<script lang="ts">
	import {
		AlertDialog,
		AlertDialogAction,
		AlertDialogCancel,
		AlertDialogContent,
		AlertDialogDescription,
		AlertDialogFooter,
		AlertDialogHeader,
		AlertDialogTitle
	} from '$lib/components/ui/alert-dialog';
	import { confirmState, settleConfirm } from '$lib/confirm.svelte';

	/**
	 * The single confirmation dialog, mounted once in the root layout.
	 * Everything it shows comes from whichever `confirmDialog(...)` call is
	 * currently awaiting an answer.
	 */

	let pending = $derived(confirmState.pending);
</script>

<AlertDialog
	open={pending !== null}
	onOpenChange={(open) => {
		// Covers Escape and an overlay click as well as Cancel.
		if (!open) settleConfirm(false);
	}}
>
	<AlertDialogContent>
		{#if pending}
			<AlertDialogHeader>
				<AlertDialogTitle>{pending.title}</AlertDialogTitle>
				{#if pending.description}
					<AlertDialogDescription>{pending.description}</AlertDialogDescription>
				{/if}
			</AlertDialogHeader>
			<AlertDialogFooter>
				<AlertDialogCancel onclick={() => settleConfirm(false)}>
					{pending.cancelLabel ?? 'Cancel'}
				</AlertDialogCancel>
				<AlertDialogAction
					variant={pending.destructive ? 'destructive' : 'default'}
					onclick={() => settleConfirm(true)}
				>
					{pending.confirmLabel ?? 'Confirm'}
				</AlertDialogAction>
			</AlertDialogFooter>
		{/if}
	</AlertDialogContent>
</AlertDialog>
