import { describe, expect, it } from 'vitest';
import { routeOf, shellCache, staleCaches } from './shell-caches';

// [D-293] A page running the previous build still loads its lazy chunks from
// that build's shell; anything older goes.
describe('staleCaches', () => {
	it('keeps the current shell, the newest older one and the named caches', () => {
		const keys = [
			shellCache('1700000000000'),
			shellCache('1700000300000'),
			shellCache('1700000600000'),
			'photos',
			'something-else'
		];
		expect(staleCaches(keys, shellCache('1700000600000'), ['photos'])).toEqual([
			shellCache('1700000000000'),
			'something-else'
		]);
	});

	it('deletes nothing on a first install', () => {
		expect(staleCaches([shellCache('1')], shellCache('1'), [])).toEqual([]);
	});
});

describe('routeOf', () => {
	const scope = new URL('https://shop.example/');
	const assets = new Set(['/', '/_app/immutable/entry/start.abc.js', '/manifest.webmanifest']);
	const route = (href: string, mode: RequestMode = 'no-cors') =>
		routeOf(new URL(href, scope), mode, scope, assets);

	it('answers every navigation from the shell, a shared list included', () => {
		expect(route('/list/abc', 'navigate')).toBe('navigation');
		expect(route('/import?text=Milch', 'navigate')).toBe('navigation');
		expect(route('/', 'navigate')).toBe('navigation');
	});

	it("leaves the server's own pages and files to the server", () => {
		expect(route('/api/oauth2-redirect?code=x', 'navigate')).toBeNull();
		expect(route('/_/', 'navigate')).toBeNull();
		expect(route('/manifest.webmanifest', 'navigate')).toBeNull();
	});

	it("serves this build's files from its shell, another build's from that one's", () => {
		expect(route('/_app/immutable/entry/start.abc.js')).toBe('shell');
		expect(route('/manifest.webmanifest')).toBe('shell');
		expect(route('/_app/immutable/entry/start.old.js')).toBe('previous-build');
	});

	it('caches product photos', () => {
		expect(route('/api/barcode/photo/0123456789abcdef0123456789abcdef')).toBe('photo');
	});

	it('passes the API, unknown paths and other origins through', () => {
		expect(route('/api/sync/push')).toBeNull();
		expect(route('/favicon-unknown.png')).toBeNull();
		expect(route('https://cdn.example/_app/immutable/entry/start.abc.js')).toBeNull();
		expect(route('https://cdn.example/api/barcode/photo/x')).toBeNull();
	});

	it('resolves the paths against a scope below the root', () => {
		const sub = new URL('https://shop.example/app/');
		const at = (href: string, mode: RequestMode = 'no-cors') =>
			routeOf(new URL(href, sub), mode, sub, new Set(['/app/']));
		expect(at('/app/list/abc', 'navigate')).toBe('navigation');
		expect(at('/app/_app/immutable/chunks/x.js')).toBe('previous-build');
		expect(at('/api/barcode/photo/x')).toBe('photo');
	});
});
