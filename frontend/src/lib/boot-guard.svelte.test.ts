// static/boot-guard.js recovers a boot chunk that failed to load before any
// app code runs ([D-357]): one guarded reload, reported, sharing D-202's
// sessionStorage budget with #lib/module-recovery.ts.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import script from '../../static/boot-guard.js?raw';
import { claimReload, MODULE_LOAD_ERROR } from './module-recovery';

/** What the guard sends: one report per claimed reload. */
type ReportFetch = (url: string, init: { body: string }) => Promise<Response>;

interface Timer {
	fn: () => void;
	ms: number;
}

/** Runs the shipped file with the page's globals, as the page does. */
function boot() {
	const handlers: Record<string, (event: unknown) => void> = {};
	const window = {
		addEventListener: (type: string, fn: (event: unknown) => void) => {
			handlers[type] = fn;
		}
	};
	const location = {
		pathname: '/list/abc',
		href: 'http://localhost/list/abc',
		assign: vi.fn()
	};
	const fetch = vi.fn<ReportFetch>(() => Promise.resolve(new Response(null, { status: 204 })));
	const timers: Timer[] = [];
	const setTimeout = (fn: () => void, ms: number) => {
		timers.push({ fn, ms });
		return timers.length;
	};
	const navigator = { userAgent: 'boot-guard test' };
	// eslint-disable-next-line @typescript-eslint/no-implied-eval -- runs the shipped file as the page does
	new Function('window', 'location', 'sessionStorage', 'fetch', 'setTimeout', 'navigator', script)(
		window,
		location,
		sessionStorage,
		fetch,
		setTimeout,
		navigator
	);
	return {
		rejection: (reason: unknown) => handlers['unhandledrejection']({ reason }),
		location,
		fetch,
		timers
	};
}

// What SvelteKit's inline boot script's import() rejects with in Chromium.
const bootFailure = new Error(
	'Failed to fetch dynamically imported module: http://localhost/_app/immutable/entry/start.abc.js'
);
const guardKey = 'shoppinglist-reload:/list/abc';

beforeEach(() => {
	sessionStorage.clear();
});

describe('static/boot-guard.js', () => {
	it("carries module-recovery's message pattern verbatim", () => {
		expect(script).toContain(`/${MODULE_LOAD_ERROR.source}/${MODULE_LOAD_ERROR.flags}`);
	});

	it('reloads once after a boot import fails, and reports it first', () => {
		const g = boot();
		g.rejection(bootFailure);
		expect(g.fetch).toHaveBeenCalledOnce();
		// The guard's own report shape.
		const body = JSON.parse(g.fetch.mock.calls[0][1].body) as Record<string, unknown>;
		expect(body).toMatchObject({
			message: bootFailure.message,
			path: '/list/abc',
			context: 'boot recovery=reload-1500ms'
		});
		expect(g.timers).toHaveLength(1);
		expect(g.timers[0].ms).toBe(1500);
		g.timers[0].fn();
		expect(g.location.assign).toHaveBeenCalledWith('http://localhost/list/abc');
	});

	it('recovers a Firefox-style dynamic import rejection', () => {
		const g = boot();
		g.rejection(
			new Error(
				'error loading dynamically imported module: http://localhost/_app/immutable/chunks/x.js'
			)
		);
		expect(g.fetch).toHaveBeenCalledOnce();
		expect(g.timers).toHaveLength(1);
		expect(g.timers[0].ms).toBe(1500);
	});

	it('leaves other rejections alone', () => {
		const g = boot();
		g.rejection(new Error('AbortError: the request was aborted'));
		g.rejection('TypeError: x is not a function');
		expect(g.fetch).not.toHaveBeenCalled();
		expect(g.timers).toHaveLength(0);
	});

	it('spends one retry per document even when several imports fail', () => {
		const g = boot();
		g.rejection(bootFailure);
		g.rejection(new Error('Failed to fetch dynamically imported module: http://localhost/x.js'));
		expect(g.fetch).toHaveBeenCalledOnce();
		expect(g.timers).toHaveLength(1);
	});

	it('shares the two-reloads-per-minute budget across documents, and reports the one it gives up on', () => {
		const first = boot();
		first.rejection(bootFailure);
		expect(first.timers[0].ms).toBe(1500);
		const second = boot();
		second.rejection(bootFailure);
		expect(second.timers[0].ms).toBe(5000);
		const third = boot();
		third.rejection(bootFailure);
		expect(third.timers).toHaveLength(0);
		expect(third.fetch).toHaveBeenCalledOnce();
		const body = JSON.parse(third.fetch.mock.calls[0][1].body) as Record<string, unknown>;
		expect(body.context).toBe('boot recovery=none');
	});

	it("shares the budget with the app's own claimReload", () => {
		const url = new URL('http://localhost/list/abc');
		expect(claimReload(url)).toBe(1500);
		const g = boot();
		g.rejection(bootFailure);
		// The guard took the second retry, in the same key and format.
		expect(g.timers[0].ms).toBe(5000);
		expect(JSON.parse(sessionStorage.getItem(guardKey) ?? '{}')).toMatchObject({ count: 2 });
		expect(claimReload(url)).toBeNull();
		const spent = boot();
		spent.rejection(bootFailure);
		expect(spent.timers).toHaveLength(0);
	});

	it('reports but does not reload without a working sessionStorage', () => {
		vi.spyOn(sessionStorage, 'setItem').mockImplementation(() => {
			throw new Error('private mode');
		});
		const g = boot();
		g.rejection(bootFailure);
		expect(g.timers).toHaveLength(0);
		expect(g.fetch).toHaveBeenCalledOnce();
		const body = JSON.parse(g.fetch.mock.calls[0][1].body) as Record<string, unknown>;
		expect(body.context).toBe('boot recovery=none');
	});
});
