// pb.ts's client rules: the SDK reads a 200 it could not finish as `{}`, so a
// response cut short has to fail before the SDK sees it; and a 401 leaves the
// session to the app (§5.8).
import { describe, expect, it, vi } from 'vitest';
import { pb } from './pb';

function answerWith(body: BodyInit) {
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => new Response(body, { headers: { 'content-type': 'application/json' } }))
	);
}

describe('pb.send', () => {
	it('fails on a 200 whose body was cut short, instead of answering {}', async () => {
		answerWith(
			new ReadableStream({
				start(controller) {
					controller.enqueue(new TextEncoder().encode('{"passkeys":{"ena'));
					controller.error(new TypeError('network error'));
				}
			})
		);

		await expect(pb.send('/api/auth/methods', { requestKey: null })).rejects.toMatchObject({
			status: 0
		});
	});

	it('answers a whole body as before', async () => {
		answerWith('{"passkeys":{"enabled":true}}');

		await expect(pb.send('/api/auth/methods', { requestKey: null })).resolves.toEqual({
			passkeys: { enabled: true }
		});
	});
});

describe('a 401', () => {
	it('keeps the stored session: an expired one pauses the sync, it does not sign out', async () => {
		pb.authStore.save('expired.token.here', { id: 'acc1', nickname: 'Anna' } as never);
		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response('{"message":"expired"}', {
						status: 401,
						headers: { 'content-type': 'application/json' }
					})
			)
		);

		await expect(pb.send('/api/sync/digest', { requestKey: null })).rejects.toMatchObject({
			status: 401
		});
		expect(pb.authStore.record?.id).toBe('acc1');
		pb.authStore.clear();
	});
});
