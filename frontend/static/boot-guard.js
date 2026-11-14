// Boot-level module-load recovery ([D-357]). A service worker stopped while
// it answers aborts the chunks it was serving, and a boot chunk that fails
// before SvelteKit's error handling exists leaves a blank page with no retry
// ([D-202] covers route loads once the app is up). Chromium's static routes
// ([D-298]) keep the worker out of the chunk path; browsers without them
// (Firefox, iOS Safari) need this guard. A classic script in <head>, it runs
// before the module graph, and being a file of the app's own origin it needs
// no CSP hash. The precache holds it, so it works offline too.
//
// SvelteKit's shell starts the app with import() from an inline script, so a
// dropped boot chunk surfaces as an unhandled rejection, never as an element's
// load error.
//
// The twin of #lib/module-recovery.ts: the same message pattern (its test
// pins the copy) and the same sessionStorage guard, so the two share one
// budget of two reloads per path per minute and cannot loop.
(function () {
	'use strict';
	var MODULE_LOAD_ERROR =
		/Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Unable to preload CSS/i;
	var GUARD_PREFIX = 'shoppinglist-reload:';
	var GUARD_MS = 60000;
	var RETRY_DELAYS_MS = [1500, 5000];
	// One claim per document: imports that fail together reject separately,
	// and must spend one retry and send one report, not one each.
	var claimed = false;

	function claimReload(pathname, now) {
		var key = GUARD_PREFIX + pathname;
		try {
			var raw = sessionStorage.getItem(key);
			var prev = raw ? JSON.parse(raw) : null;
			var fresh = !prev || now - prev.first >= GUARD_MS;
			var count = fresh ? 0 : prev.count;
			if (count >= RETRY_DELAYS_MS.length) return null;
			sessionStorage.setItem(
				key,
				JSON.stringify({ first: fresh ? now : prev.first, count: count + 1 })
			);
			return RETRY_DELAYS_MS[count];
		} catch {
			// No sessionStorage (private mode quirks): without a guard, do not risk a loop.
			return null;
		}
	}

	function report(message, context) {
		try {
			// keepalive: the report must outlive the reload it announces.
			fetch('/api/client-errors', {
				method: 'POST',
				keepalive: true,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					message: message,
					stack: '',
					route: '',
					path: location.pathname,
					status: 0,
					context: context,
					version: '',
					agent: navigator.userAgent
				})
			}).catch(function () {});
		} catch {
			// A failed report must never become a second error.
		}
	}

	function recover(message) {
		if (claimed) return;
		claimed = true;
		var delay = claimReload(location.pathname, Date.now());
		// Retries spent (or no guard to count them): the page stays blank, and
		// this report is the only trace of it.
		report(message, 'boot recovery=' + (delay === null ? 'none' : 'reload-' + delay + 'ms'));
		if (delay === null) return;
		setTimeout(function () {
			location.assign(location.href);
		}, delay);
	}

	window.addEventListener('unhandledrejection', function (event) {
		var reason = event.reason;
		var message = reason instanceof Error ? reason.message : String(reason);
		if (MODULE_LOAD_ERROR.test(message)) recover(message);
	});
})();
