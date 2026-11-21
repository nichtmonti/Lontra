// RenameListDialog ([D-360]): the private name is offered where it can tell
// lists apart, on a list with another member, and wherever one is set, so it
// can always be cleared. A list only this account is on keeps one field.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#lib/sync/roster.js', () => ({ refreshRoster: vi.fn().mockResolvedValue([]) }));

import { db, rosterKey } from '#lib/db.js';
import { refreshRoster } from '#lib/sync/roster.js';
import { resetDb } from '#lib/test-kit/db.js';
import RenameListDialog from './RenameListDialog.svelte';

const base = {
	open: true,
	listId: 'list-a',
	globalName: 'Zuhause',
	localName: '',
	busy: false,
	error: undefined,
	onsubmit: vi.fn(),
	oncancel: vi.fn()
};

async function member(account: string): Promise<void> {
	await db.roster.put({
		id: rosterKey('list-a', account),
		list: 'list-a',
		account,
		nickname: account,
		joined: '2026-11-01T00:00:00.000Z'
	});
}

beforeEach(async () => {
	await resetDb();
	vi.clearAllMocks();
});

describe('RenameListDialog', () => {
	it('a list only this account is on has one field, for its name', async () => {
		await member('anna');
		render(RenameListDialog, { props: base });
		const dialog = await screen.findByRole('dialog', { name: 'Umbenennen' });

		expect(within(dialog).getByLabelText<HTMLInputElement>('Name').value).toBe('Zuhause');
		expect(within(dialog).queryByLabelText('Name nur für dich')).toBeNull();
		await fireEvent.click(within(dialog).getByRole('button', { name: 'Speichern' }));
		expect(base.onsubmit).toHaveBeenCalledWith('Zuhause', '');
	});

	it('a shared list offers the private name under the shared one', async () => {
		await member('anna');
		await member('ben');
		render(RenameListDialog, { props: base });
		const dialog = await screen.findByRole('dialog', { name: 'Umbenennen' });

		const own = await within(dialog).findByLabelText<HTMLInputElement>('Name nur für dich');
		expect(own.value).toBe('');
		expect(own.placeholder).toBe('Zuhause');
		expect(within(dialog).getByLabelText<HTMLInputElement>('Name für alle').value).toBe('Zuhause');
		expect(
			within(dialog).getByText('Nur du siehst ihn, auf allen deinen Geräten.', { exact: false })
		).toBeDefined();

		await fireEvent.input(own, { target: { value: ' Zuhause bei Anna ' } });
		await fireEvent.click(within(dialog).getByRole('button', { name: 'Speichern' }));
		expect(base.onsubmit).toHaveBeenCalledWith('Zuhause', 'Zuhause bei Anna');
	});

	// The roster is fetched once a session: Ben joined the list after it, so
	// only the read on open learns that the list is shared.
	it('a member who joined since the cached roster brings the private name', async () => {
		await member('anna');
		vi.mocked(refreshRoster).mockImplementationOnce(async () => {
			await member('ben');
			return [];
		});
		render(RenameListDialog, { props: base });
		const dialog = await screen.findByRole('dialog', { name: 'Umbenennen' });

		expect(await within(dialog).findByLabelText('Name nur für dich')).toBeDefined();
		expect(refreshRoster).toHaveBeenCalledWith('list-a');
	});

	it('a private name stays clearable on a list its other members left', async () => {
		await member('anna');
		render(RenameListDialog, { props: { ...base, localName: 'Bei Anna' } });
		const dialog = await screen.findByRole('dialog', { name: 'Umbenennen' });

		const own = within(dialog).getByLabelText<HTMLInputElement>('Name nur für dich');
		expect(own.value).toBe('Bei Anna');
		await fireEvent.input(own, { target: { value: '' } });
		await fireEvent.click(within(dialog).getByRole('button', { name: 'Speichern' }));
		await waitFor(() => expect(base.onsubmit).toHaveBeenCalledWith('Zuhause', ''));
	});

	it('the shared name stays required', async () => {
		await member('anna');
		await member('ben');
		render(RenameListDialog, { props: base });
		const dialog = await screen.findByRole('dialog', { name: 'Umbenennen' });

		await fireEvent.input(await within(dialog).findByLabelText('Name für alle'), {
			target: { value: ' ' }
		});
		await fireEvent.click(within(dialog).getByRole('button', { name: 'Speichern' }));
		expect(base.onsubmit).not.toHaveBeenCalled();
		expect(within(dialog).getByText('Bitte zuerst ausfüllen.')).toBeDefined();
	});
});
