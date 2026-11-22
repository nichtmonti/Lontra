<!--
  A home card's face ([D-362]): what is still to buy, as a cluster of up to
  three of its category plates in aisle order, overlapping at their corners,
  the first in front; one alone is larger. With nothing to buy it shows what
  the list itself shows then ([§9.1]): 🎉 when all is done, 🛒 when empty. Decorative: the card's link says the rest. The
  plates are ringed in the card's colour, as a corner mark is, so the cluster
  reads as plates laid on one another. Its 48px set every card's height,
  with or without a line under the name.
-->
<script lang="ts">
	import CategoryPlate from '#lib/components/common/CategoryPlate.svelte';
	import { categoryStyle, faceCategories, templateMap } from '#lib/categories.js';
	import {
		categoryTemplates,
		listCategories,
		listCounts,
		listIndex,
		listOpenItems
	} from '#lib/state/data.js';

	let { listId }: { listId: string } = $props();

	let openStore = $derived(listOpenItems(listId));
	let openLoaded = $derived(openStore.loaded);
	let categoriesStore = $derived(listCategories(listId));
	let countsStore = $derived(listCounts(listId));
	let face = $derived(
		faceCategories($openStore, $categoriesStore, templateMap($categoryTemplates))
	);
	// Nothing to buy only once it is true ([D-185]): read, and pulled.
	let known = $derived(
		$openLoaded && $listIndex.some((l) => l.id === listId && l.updated !== undefined)
	);

	// Each plate's place in the 48px face, back to front: the first category
	// is drawn last, in front, at the bottom.
	const CLUSTER: Record<number, string[]> = {
		2: ['left-0 top-0', 'right-0 bottom-0'],
		3: ['right-0 top-1.5', 'left-0 top-0', 'left-2.75 bottom-0']
	};
</script>

<span
	class="relative size-12 flex-none"
	aria-hidden="true"
	data-testid="list-face"
	data-face={face.length ? 'categories' : !known ? 'unread' : $countsStore.done ? 'done' : 'empty'}
>
	{#if face.length === 1}
		<CategoryPlate
			icon={face[0].icon}
			style={categoryStyle(face[0].color)}
			class="absolute top-1.75 left-1.75"
		/>
	{:else if face.length}
		{#each face.toReversed() as category, i (category.id)}
			<CategoryPlate
				icon={category.icon}
				size="head"
				style={categoryStyle(category.color)}
				class="absolute ring-2 ring-surface-2 {CLUSTER[face.length][i]}"
			/>
		{/each}
	{:else if known}
		<CategoryPlate icon={$countsStore.done ? '🎉' : '🛒'} class="absolute top-1.75 left-1.75" />
	{/if}
</span>
