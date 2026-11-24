// Which app-shell caches an activating service worker deletes ([D-293]). A
// page still running the previous build loads its lazy chunks (the passkey
// library, the scanner, the QR code, the photo viewer) by that build's hashed
// paths, which the new shell does not have: the server would answer them
// with index.html. So the newest older shell stays until the next deploy.
//
// Also which strategy the worker answers a request with (routeOf).
import { PHOTO_PATH } from './photo-cache';

const PREFIX = 'shell-';

/** The cache name of a build's shell. */
export function shellCache(version: string): string {
	return PREFIX + version;
}

/**
 * The caches to delete: every shell but `current` and the newest older one,
 * by the build version SvelteKit stamps (a timestamp); every other cache but
 * those in `keep`.
 */
export function staleCaches(keys: string[], current: string, keep: string[]): string[] {
	const older = keys
		.filter((key) => key.startsWith(PREFIX) && key !== current)
		.sort((a, b) => Number(b.slice(PREFIX.length)) - Number(a.slice(PREFIX.length)));
	const previous = older[0];
	return keys.filter((key) => key !== current && key !== previous && !keep.includes(key));
}

// The server's own pages: PocketBase's API (the OIDC callback, a file
// download) and its dashboard, at the origin's root whatever the app's base.
const SERVER_PAGES = ['/api/', '/_/'];

/** Whether a navigation is to one of the app's screens, which the shell
 *  renders, rather than to a page or file the server answers itself. */
function appPage(url: URL, scope: URL, assets: ReadonlySet<string>): boolean {
	if (SERVER_PAGES.some((prefix) => url.pathname.startsWith(prefix))) return false;
	// The shell itself is in `assets`, under the scope's root.
	return url.pathname === scope.pathname || !assets.has(url.pathname);
}

/** How the service worker answers a request; null passes it to the network
 *  untouched. */
export type Route = 'navigation' | 'photo' | 'previous-build' | 'shell' | null;

/**
 * The strategy for a GET request. `scope` is the worker's scope, which the
 * manifest's paths are relative to; `assets` holds the absolute pathnames of
 * this build's shell. Only our own hash-named build and static files are
 * served from the shell: everything else on the origin (in particular /api/*)
 * and every cross-origin request passes through.
 */
export function routeOf(
	url: URL,
	mode: RequestMode,
	scope: URL,
	assets: ReadonlySet<string>
): Route {
	if (url.origin !== scope.origin) return null;
	if (mode === 'navigate') return appPage(url, scope, assets) ? 'navigation' : null;
	if (url.pathname.startsWith(PHOTO_PATH)) return 'photo';
	if (assets.has(url.pathname)) return 'shell';
	// Another build's chunk ([D-293]).
	if (url.pathname.startsWith(new URL('_app/immutable/', scope).pathname)) {
		return 'previous-build';
	}
	return null;
}
