<!--
  What a home card shows ([D-362]), and the arrange view with it ([D-238]):
  the list's face, its summary, and under the name who changed it last and
  when, the newest change the server has stamped. A change not yet sent is
  the summary's amber badge.
-->
<script lang="ts">
	import { currentAccountId } from '#lib/auth/state.js';
	import { relativeTime, t } from '#lib/i18n/index.js';
	import { memberName } from '#lib/member-name.js';
	import { Now } from '#lib/state/clock.svelte.js';
	import { listLatestChange, listRoster, type MyList } from '#lib/state/data.js';
	import ListSummary from '#lib/components/list/ListSummary.svelte';
	import ListFace from './ListFace.svelte';

	let { membership, idBase }: { membership: MyList; idBase?: string } = $props();

	let latestStore = $derived(listLatestChange(membership.list));
	let rosterStore = $derived(listRoster(membership.list));
	let latest = $derived($latestStore);

	const MINUTE_MS = 60_000;
	const HOUR_MS = 3_600_000;
	// "vor 20 Sek." moves every 10 seconds for a minute, "vor 3 Min." each
	// minute for an hour, then each hour.
	const now = new Now((at) => {
		const then = latest ? Date.parse(latest.updated) : NaN;
		if (Number.isNaN(then)) return null;
		const age = at - then;
		return at + (age < MINUTE_MS ? 10_000 : age < HOUR_MS ? MINUTE_MS : HOUR_MS);
	});

	// A member the roster cache does not know leaves the time alone.
	let who = $derived.by(() => {
		const by = latest?.modified_by;
		if (!by) return '';
		if (by === currentAccountId()) return t('home_card_activity_you');
		const member = $rosterStore.find((m) => m.account === by);
		return member ? memberName(member.nickname) : '';
	});
	let when = $derived(latest ? relativeTime(latest.updated, now.value, 'short') : '');
	let activity = $derived(who && when ? t('home_card_activity', { who, when }) : when);
</script>

<span class="flex min-w-0 items-center gap-3">
	<ListFace listId={membership.list} />
	<span class="min-w-0 flex-1">
		<ListSummary {membership} {idBase} greenDone>
			{#snippet meta()}
				{#if activity}
					<span
						id={idBase && `${idBase}-activity`}
						class="truncate text-meta text-muted-foreground"
						data-testid="card-activity">{activity}</span
					>
				{/if}
			{/snippet}
		</ListSummary>
	</span>
</span>
