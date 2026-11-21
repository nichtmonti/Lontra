<!--
  A list's one rename, for both of its ⋮ menus ([D-270]): the shared name
  every member sees ([D-08]) and, under it, the member's private one
  ([D-360]), with the shared name as its placeholder. The private field shows
  while the list has another member, or while there is a private name to
  clear; a list only this account is on gets the shared field alone. What
  `onsubmit` receives is both names, trimmed; the caller sends what changed.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { t } from '#lib/i18n/index.js';
	import { maxBytesFor } from '#lib/field-contract.js';
	import PromptDialog from '#lib/components/ui/PromptDialog.svelte';
	import { Field, FieldLabel } from '#lib/components/ui/field/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { listRoster } from '#lib/state/data.js';
	import { refreshRoster } from '#lib/sync/index.js';

	let {
		open,
		listId,
		globalName,
		localName,
		busy,
		error,
		onsubmit,
		oncancel
	}: {
		open: boolean;
		listId: string;
		globalName: string;
		localName: string;
		busy: boolean;
		error: string | undefined;
		onsubmit: (globalName: string, localName: string) => void;
		oncancel: () => void;
	} = $props();

	// The cached roster (§7.4), read again on open as the leave's is: it is
	// fetched once a session, so a member who joined since is not in it yet.
	// Until it loads, a list counts as this account's alone.
	$effect(() => {
		if (open && listId) void refreshRoster(listId).catch(() => {});
	});
	let rosterStore = $derived(listRoster(listId));
	let rosterLoaded = $derived(rosterStore.loaded);
	let offerLocal = $derived(localName !== '' || ($rosterLoaded && $rosterStore.length > 1));

	// Seeded on each open only, as the prompt's own field is.
	let localDraft = $state('');
	$effect(() => {
		if (open) localDraft = untrack(() => localName);
	});
</script>

<PromptDialog
	{open}
	title={t('home_action_rename')}
	label={offerLocal ? t('home_rename_shared_label') : t('common_name')}
	maxlength={maxBytesFor('lists', 'name')}
	value={globalName}
	{busy}
	{error}
	onsubmit={(name) => onsubmit(name, offerLocal ? localDraft.trim() : localName)}
	{oncancel}
>
	{#if offerLocal}
		<Field class="mb-4" hint={t('home_rename_local_hint')}>
			<FieldLabel for="rename-local-input">{t('home_rename_local_label')}</FieldLabel>
			<Input
				id="rename-local-input"
				type="text"
				dir="auto"
				autocomplete="off"
				enterkeyhint="done"
				bind:value={localDraft}
				placeholder={globalName}
				maxlength={maxBytesFor('memberships', 'local_name')}
				disabled={busy}
			/>
		</Field>
	{/if}
</PromptDialog>
