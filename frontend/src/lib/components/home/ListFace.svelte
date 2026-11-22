<!--
  A home card's face ([D-362]): what is still to buy, as up to five of its
  category plates in aisle order, scattered so they overlap at their
  corners, the first in front; one alone is larger. With nothing to buy it
  shows what the list itself shows then ([§9.1]): 🎉 when all is done, 🛒
  when empty. Decorative: the card's link says the rest. The plates are
  ringed in the card's colour, as a corner mark is, so they read as plates
  laid on one another. Its 48px set every card's height, with or without a
  line under the name; its 56px width every name's start.
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

	// Each plate's place in the 56×48px face, front to back: the first
	// category in front, at the bottom. Nothing lines up, so it reads as plates
	// dropped on the card; up to four fit 48px, centred. Two take the larger
	// plate, overlapping more, in the same space.
	const SCATTER: Record<number, string[]> = {
		2: ['left-4.5 top-3.5', 'left-1 top-0'],
		3: ['left-3.75 top-5.5', 'left-1 top-0', 'left-6.5 top-1.5'],
		4: ['left-2.5 top-5.5', 'left-7 top-4.5', 'left-1 top-0', 'left-6.25 top-0.5'],
		5: [
			'left-3.25 top-5.5',
			'left-0 top-3.5',
			'left-7.5 top-4.25',
			'left-1.25 top-0',
			'left-6 top-0.5'
		]
	};
</script>

<span
	class="relative h-12 w-14 flex-none"
	aria-hidden="true"
	data-testid="list-face"
	data-face={face.length ? 'categories' : !known ? 'unread' : $countsStore.done ? 'done' : 'empty'}
>
	{#if face.length === 1}
		<CategoryPlate
			icon={face[0].icon}
			style={categoryStyle(face[0].color)}
			class="absolute top-1.75 left-2.75"
		/>
	{:else if face.length}
		{#each face.toReversed() as category, i (category.id)}
			<CategoryPlate
				icon={category.icon}
				size={face.length === 2 ? 'row' : 'head'}
				style={categoryStyle(category.color)}
				class="absolute ring-2 ring-surface-2 {SCATTER[face.length][face.length - 1 - i]}"
			/>
		{/each}
	{:else if known}
		<CategoryPlate icon={$countsStore.done ? '🎉' : '🛒'} class="absolute top-1.75 left-2.75" />
	{/if}
</span>
