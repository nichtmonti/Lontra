// A row or tile that leaves its list when activated (a ticked tile, a restored
// done row, a re-added previous item) takes its focus with it, and the next
// Tab would start again at the app bar. It hands the focus on instead: to the
// next row, else the one before, else `fallback` (WCAG 2.4.3). A tap moves it
// without scrolling, so the rows do not jump under a finger.

export interface Neighbours {
	/** The element whose `rows` are the leaving row's list, in drawing order. */
	within: (row: HTMLElement) => ParentNode | null | undefined;
	/** The selector of the rows, the leaving one among them. */
	rows: string;
	/** Where the focus goes when no row is left. */
	fallback?: (row: HTMLElement) => HTMLElement | null | undefined;
}

/** The row that takes the focus from `row`: the next, else the one before,
 *  else the fallback. */
export function neighbourOf(
	row: HTMLElement,
	{ within, rows, fallback }: Neighbours
): HTMLElement | null | undefined {
	// In the order the screen draws them, which only the DOM knows.
	const all = [...(within(row)?.querySelectorAll<HTMLElement>(rows) ?? [])];
	const at = all.indexOf(row);
	return all[at + 1] ?? all[at - 1] ?? fallback?.(row);
}

/**
 * Hands the focus on from the row `event` activated, before it leaves.
 * Nothing happens unless that row has the focus.
 */
export function focusNeighbour(event: MouseEvent, neighbours: Neighbours): void {
	const row = event.currentTarget;
	if (!(row instanceof HTMLElement) || document.activeElement !== row) return;
	neighbourOf(row, neighbours)?.focus({ preventScroll: event.detail > 0 });
}
