// Both Dialog and AlertDialog follow window.visualViewport so an on-screen
// keyboard does not cover a centred dialog ([D-365]).
import { render } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import ConfirmDialog from '../ConfirmDialog.svelte';
import PromptDialog from '../PromptDialog.svelte';

function withVisualViewport(
	initial: { height: number; offsetTop?: number; scale?: number },
	run: (vv: EventTarget & { height: number; offsetTop: number; scale: number }) => void
): void {
	const prevInnerHeight = window.innerHeight;
	Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
	const vv = Object.assign(new EventTarget(), {
		height: initial.height,
		offsetTop: initial.offsetTop ?? 0,
		scale: initial.scale ?? 1
	});
	Object.defineProperty(window, 'visualViewport', { configurable: true, value: vv });
	try {
		run(vv);
	} finally {
		Reflect.deleteProperty(window, 'visualViewport');
		Object.defineProperty(window, 'innerHeight', { configurable: true, value: prevInnerHeight });
	}
}

// The properties do nothing unless the card's CSS reads them: its centre and
// its height cap both follow --vv-top and --vv-height.
function expectReadsViewport(dialog: HTMLElement): void {
	const classes = dialog.className.split(/\s+/);
	expect(classes).toContainEqual(
		expect.stringMatching(/^top-\[calc\(var\(--vv-top,.*--vv-height,/)
	);
	expect(classes).toContainEqual(expect.stringMatching(/^max-h-\[calc\(var\(--vv-height,/));
}

describe('dialogSurface visual-viewport fit ([D-365])', () => {
	it('tracks resize and pan on DialogContent, ignores pinch-zoom, and resets on close', () => {
		withVisualViewport({ height: 844, offsetTop: 0 }, (vv) => {
			const { unmount } = render(PromptDialog, {
				props: {
					open: true,
					title: 'Spitzname',
					label: 'Spitzname',
					value: 'Anna',
					onsubmit: vi.fn(),
					oncancel: vi.fn()
				}
			});
			const dialog = document.querySelector<HTMLElement>('[data-slot="dialog-content"]')!;
			expectReadsViewport(dialog);
			expect(dialog.style.getPropertyValue('--vv-top')).toBe('');
			expect(dialog.style.getPropertyValue('--vv-height')).toBe('');

			// Keyboard opens (~336px) and Safari pans the visual viewport by 48px.
			vv.height = 508;
			vv.offsetTop = 48;
			vv.dispatchEvent(new Event('resize'));
			expect(dialog.style.getPropertyValue('--vv-top')).toBe('48px');
			expect(dialog.style.getPropertyValue('--vv-height')).toBe('508px');

			// Safari adjusts the visual-viewport pan during scroll; negative bounce clamps to 0.
			vv.offsetTop = 92.4;
			vv.dispatchEvent(new Event('scroll'));
			expect(dialog.style.getPropertyValue('--vv-top')).toBe('92px');
			vv.offsetTop = -12;
			vv.dispatchEvent(new Event('scroll'));
			expect(dialog.style.getPropertyValue('--vv-top')).toBe('0px');

			// Pinch-zoom is ignored rather than cramping the dialog.
			vv.scale = 1.5;
			vv.dispatchEvent(new Event('resize'));
			expect(dialog.style.getPropertyValue('--vv-top')).toBe('');
			expect(dialog.style.getPropertyValue('--vv-height')).toBe('');

			// Keyboard closes: properties clear and CSS falls back to 100dvh.
			vv.scale = 1;
			vv.height = 844;
			vv.offsetTop = 0;
			vv.dispatchEvent(new Event('resize'));
			expect(dialog.style.getPropertyValue('--vv-top')).toBe('');
			expect(dialog.style.getPropertyValue('--vv-height')).toBe('');

			unmount();
		});
	});

	it('tracks the visual viewport on AlertDialogContent too', () => {
		withVisualViewport({ height: 500, offsetTop: 20 }, (vv) => {
			render(ConfirmDialog, {
				props: {
					open: true,
					title: 'Bestätigen',
					body: 'Sicher?',
					confirmLabel: 'Ja',
					onconfirm: vi.fn(),
					oncancel: vi.fn()
				}
			});
			const dialog = document.querySelector<HTMLElement>('[data-slot="alert-dialog-content"]')!;
			expectReadsViewport(dialog);
			expect(dialog.style.getPropertyValue('--vv-top')).toBe('20px');
			expect(dialog.style.getPropertyValue('--vv-height')).toBe('500px');

			vv.height = 844;
			vv.offsetTop = 0;
			vv.dispatchEvent(new Event('resize'));
			expect(dialog.style.getPropertyValue('--vv-height')).toBe('');
		});
	});
});
