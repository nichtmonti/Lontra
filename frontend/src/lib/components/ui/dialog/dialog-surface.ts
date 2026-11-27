// The card a dialog or a confirmation is ([D-311], [D-327], [D-365]): centred
// in the visible viewport above any on-screen keyboard, --dialog-max wide or
// 16px in from the screen's edges, padded 16px like a sheet, its blocks 16px
// apart, never taller than the visible viewport (a long one scrolls inside).
export const dialogSurface =
	'fixed top-[calc(var(--vv-top,0px)+var(--vv-height,100dvh)/2)] left-1/2 z-(--layer-modal) grid max-h-[calc(var(--vv-height,100dvh)-2rem)] w-full max-w-[min(calc(100%-2rem),var(--dialog-max))] -translate-1/2 gap-4 overflow-y-auto p-4 text-sm text-foreground outline-none duration-(--motion-pop) data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95';

/**
 * Keeps a centred fixed dialog inside the visual viewport while an on-screen
 * keyboard is open ([D-365]): on iOS Safari (and Android Chrome under
 * resizes-visual), `100dvh` and `top: 50%` keep measuring the full layout
 * viewport, so a prompt dialog sits behind the keyboard once its input takes
 * focus.
 *
 * Writes both `--vv-top` (`offsetTop`) and `--vv-height` (`height`) so any
 * Safari visual-viewport pan is followed instead of double-counted (the bug
 * [D-348] removed from vaul's `bottom` shim). When the visual viewport matches
 * the layout viewport — or the user is pinch-zoomed — both properties are
 * cleared and CSS falls back to `100dvh`.
 */
export function fitVisualViewport(el: HTMLElement): () => void {
	const vv = window.visualViewport;
	if (!vv) return () => {};

	const sync = () => {
		const shifted =
			(vv.scale ?? 1) <= 1.05 && (vv.offsetTop > 0.5 || vv.height < window.innerHeight - 1);
		if (shifted) {
			el.style.setProperty('--vv-top', `${Math.max(0, Math.round(vv.offsetTop))}px`);
			el.style.setProperty('--vv-height', `${Math.round(vv.height)}px`);
		} else {
			el.style.removeProperty('--vv-top');
			el.style.removeProperty('--vv-height');
		}
	};

	sync();
	vv.addEventListener('resize', sync);
	vv.addEventListener('scroll', sync);
	return () => {
		vv.removeEventListener('resize', sync);
		vv.removeEventListener('scroll', sync);
		el.style.removeProperty('--vv-top');
		el.style.removeProperty('--vv-height');
	};
}
