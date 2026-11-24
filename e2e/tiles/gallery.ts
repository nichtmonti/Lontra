import { expect, type Locator, type Page } from '@playwright/test';

// Opens /dev/gallery in one configuration, by URL. The gallery's settings are
// its query parameters (frontend/src/routes/dev/gallery/axes.ts), so a
// harness never drives the toolbar; it names what it wants to see and gets
// the current-app row back. Inside it, `.frame[data-view]` is one preview and
// `[data-item="<id>"]` one item's cell, its id the fixture case's (fixtures.ts).
// Comparisons are `[data-variant="<id>"]` rows (comparisons.ts).

type OneOrMany<T> = T | T[];
export interface GalleryQuery {
	/** 'none' or a comparison id from comparisons.ts. */
	compare?: string;
	content?: 'everyday' | 'stress' | 'photos';
	state?: 'normal' | 'done' | 'empty' | 'loading';
	kind?: 'mixed' | 'plain' | 'photo' | 'scan' | 'failed';
	view?: OneOrMany<'shop' | 'list'>;
	theme?: OneOrMany<'light' | 'dark'>;
	density?: OneOrMany<'comfortable' | 'compact' | 'list'>;
	width?: number;
	scale?: number;
	locale?: 'de' | 'en';
	order?: 'default' | 'az' | 'category';
	captions?: boolean;
	outlines?: boolean;
}

function param(value: string | number | boolean | string[]): string {
	if (Array.isArray(value)) return value.join(',');
	if (typeof value === 'boolean') return value ? '1' : '0';
	return `${value}`;
}

export function galleryUrl(query: GalleryQuery = {}): string {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(query) as [string, GalleryQuery[keyof GalleryQuery]][])
		if (value !== undefined) params.set(key, param(value));
	const search = params.toString();
	return `/dev/gallery${search ? `?${search}` : ''}`;
}

/** Opens the gallery and returns its current-app row. The first visit loads
 *  the page, and waits long: the dev server transforms the gallery's graph on
 *  demand. Later visits on the same page move by a link, so SvelteKit
 *  navigates in place and the dev server serves the module graph once per
 *  page instead of once per state. */
export async function openGallery(page: Page, query: GalleryQuery = {}): Promise<Locator> {
	const url = galleryUrl(query);
	const gallery = page.locator('[data-gallery-ready]');
	if ((await gallery.count()) > 0) {
		// A link, because SvelteKit has no way to navigate a page from outside
		// it: a click on one is its client-side navigation, as a user's would be.
		// Inside the gallery, where SvelteKit's router sees the click.
		await page.evaluate((href) => {
			const a = Object.assign(document.createElement('a'), { href });
			a.dataset.sveltekitReplacestate = '';
			document.querySelector('[data-gallery-ready]')?.append(a);
			a.click();
			a.remove();
		}, url);
		await expect(gallery).toHaveAttribute('data-gallery-query', new URL(url, 'http://x').search);
	} else {
		await page.goto(url);
		await gallery.waitFor({ timeout: 120_000 });
	}
	const current = page.locator('[data-variant="current"]').first();
	await current.waitFor();
	return current;
}
