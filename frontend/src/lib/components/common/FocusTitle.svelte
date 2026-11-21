<!--
  A focus screen's h1 ([D-323]). Where a visitor may not have reached settings
  yet, the language switch shares its row (§12.2), so it reads as a page
  setting, not a second call to action. A tagline under the title says what
  a name alone does not ([D-361]).
-->
<script lang="ts">
	import Hint from './Hint.svelte';
	import LocaleToggle from './LocaleToggle.svelte';

	let {
		title,
		tagline,
		locale = false
	}: { title: string; tagline?: string; locale?: boolean } = $props();
</script>

<div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
	<div>
		<h1 class="type-hero">{title}</h1>
		{#if tagline}<Hint size="sm">{tagline}</Hint>{/if}
	</div>
	{#if locale}<LocaleToggle testid="auth-locale" />{/if}
</div>
