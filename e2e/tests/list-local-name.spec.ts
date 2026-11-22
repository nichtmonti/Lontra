import { expect, test } from './fixtures';
import {
	appearsAfter,
	createList,
	readAuthBlob,
	registerAccount,
	shareListWith,
	writeAuthBlob
} from './helpers';

// [D-360]: a member of two lists both called "Zuhause" gives one a private
// name in its rename dialog, under the shared one, and tells them apart on
// their own screens and devices. The shared name stays what the co-members
// see: the override rides the member's own membership row, never the list's.
test('a private name distinguishes two same-named lists, and stays private', async ({
	browser
}) => {
	const ctxA = await browser.newContext();
	const pageA = await ctxA.newPage();
	await registerAccount(pageA, 'Anna');
	const firstUrl = await createList(pageA, 'Zuhause');

	// A co-member on the first list, to prove the override never reaches them.
	const ctxB = await browser.newContext();
	const pageB = await ctxB.newPage();
	await registerAccount(pageB, 'Ben');
	await shareListWith(pageA, pageB);

	// Back home, a second list with the SAME shared name.
	await appearsAfter(pageA.getByRole('button', { name: 'Neue Liste' }).first(), () =>
		pageA.getByRole('button', { name: 'Zurück' }).click()
	);
	await createList(pageA, 'Zuhause');
	const secondUrl = pageA.url();
	expect(secondUrl).not.toBe(firstUrl);

	// The ▾ quick-switcher shows both lists under one name — the ambiguity
	// the override exists for.
	await pageA.getByRole('button', { name: 'Zuhause', exact: true }).click();
	const switcher = pageA.getByRole('dialog', { name: 'Listen', exact: true });
	await expect(switcher.getByRole('button', { name: /^Zuhause/ })).toHaveCount(2);
	await switcher
		.getByRole('button', { name: /^Zuhause/ })
		.and(switcher.locator('button:not([aria-current])'))
		.click();
	await expect(pageA).toHaveURL(firstUrl);

	// The rename offers Anna a name of her own under the shared one, which
	// stands in it as its placeholder.
	await pageA.getByTestId('list-menu').click();
	await pageA.getByRole('button', { name: 'Umbenennen', exact: true }).click();
	const dialog = pageA.getByRole('dialog', { name: 'Umbenennen' });
	const own = dialog.getByLabel('Name nur für dich');
	await expect(own).toHaveValue('');
	await expect(own).toHaveAttribute('placeholder', 'Zuhause');
	await expect(dialog.getByLabel('Name für alle')).toHaveValue('Zuhause');
	await own.fill('Zuhause bei Anna');
	await dialog.getByRole('button', { name: 'Speichern' }).click();
	await expect(pageA.getByRole('button', { name: 'Zuhause bei Anna', exact: true })).toBeVisible();

	// The switcher now tells the two apart.
	await pageA.getByRole('button', { name: 'Zuhause bei Anna', exact: true }).click();
	await expect(switcher.getByRole('button', { name: 'Zuhause leer', exact: true })).toBeVisible();
	await expect(switcher.getByRole('button', { name: /^Zuhause bei Anna/ })).toHaveAttribute(
		'aria-current',
		'true'
	);
	await pageA.keyboard.press('Escape');

	// A fresh browser for Anna learns the private name from the server.
	const ctxSecondDevice = await browser.newContext();
	const secondDevice = await ctxSecondDevice.newPage();
	await secondDevice.goto('/');
	await writeAuthBlob(secondDevice, await readAuthBlob(pageA));
	await secondDevice.goto(firstUrl);
	await expect(
		secondDevice.getByRole('button', { name: 'Zuhause bei Anna', exact: true })
	).toBeVisible();

	// A new shared name, from the same dialog, reaches Ben; Anna's screens
	// keep her own.
	await pageA.getByTestId('list-menu').click();
	await pageA.getByRole('button', { name: 'Umbenennen', exact: true }).click();
	const again = pageA.getByRole('dialog', { name: 'Umbenennen' });
	await expect(again.getByLabel('Name nur für dich')).toHaveValue('Zuhause bei Anna');
	await again.getByLabel('Name für alle').fill('Wohnung');
	await again.getByRole('button', { name: 'Speichern' }).click();
	await expect(again).toBeHidden();
	await expect(pageA.getByRole('button', { name: 'Zuhause bei Anna', exact: true })).toBeVisible();
	// Her ⋮ names the new shared name under her own, so it does not pass her by.
	await pageA.getByTestId('list-menu').click();
	await expect(pageA.getByRole('dialog', { name: 'Zuhause bei Anna' })).toHaveAccessibleDescription(
		/Wohnung/
	);
	await pageA.keyboard.press('Escape');

	// Ben's next cycle brings the new shared name, the proof it ran after
	// Anna's private one, which it does not bring.
	await pageB.reload();
	await expect(pageB.getByRole('button', { name: 'Wohnung', exact: true })).toBeVisible({
		timeout: 15_000
	});
	await expect(pageB.getByText('Zuhause bei Anna')).toHaveCount(0);

	// Clearing the private name brings the shared one back on Anna's screens.
	await pageA.getByTestId('list-menu').click();
	await pageA.getByRole('button', { name: 'Umbenennen', exact: true }).click();
	const clear = pageA.getByRole('dialog', { name: 'Umbenennen' });
	await expect(clear.getByLabel('Name nur für dich')).toHaveValue('Zuhause bei Anna');
	await clear.getByLabel('Name nur für dich').fill('');
	await clear.getByRole('button', { name: 'Speichern' }).click();
	await expect(pageA.getByRole('button', { name: 'Wohnung', exact: true })).toBeVisible();
	await secondDevice.reload();
	await expect(secondDevice.getByRole('button', { name: 'Wohnung', exact: true })).toBeVisible({
		timeout: 15_000
	});

	await ctxA.close();
	await ctxB.close();
	await ctxSecondDevice.close();
});
