import { test, expect, type Page } from '@playwright/test';
import { createSampleWorkspace } from '../../src/domain/fixtures';
import { compareEvidence } from '../../src/features/comparison/engine';
test.setTimeout(30000);
async function fakeOperator(page: Page) {
  const workspace = createSampleWorkspace(undefined, 'operator');
  const eventIds: string[] = [];
  const invoiceIds: string[] = [];
  let loseFirstEvent = true;
  const claims = new Map<string, string>();
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const body = request.method() === 'POST' ? request.postDataJSON() : {};
    let result: unknown = {};
    if (path === '/api/workspace') result = workspace;
    else if (path === '/api/compare')
      result = compareEvidence(
        workspace.briefs[0],
        workspace.quotes,
        workspace.evidence,
        { memories: workspace.memories, status: 'complete', missingActiveIds: [] },
        new Date().toISOString(),
      );
    else if (path === '/api/orders/events') {
      eventIds.push(body.id);
      if (!workspace.orderEvents.some((e) => e.id === body.id)) workspace.orderEvents.push(body);
      if (loseFirstEvent) {
        loseFirstEvent = false;
        await route.abort();
        return;
      }
      result = { event: body, memory: { state: 'pending' } };
    } else if (path === '/api/invoices') {
      invoiceIds.push(body.id);
      if (!workspace.invoices.some((i) => i.id === body.id)) workspace.invoices.push(body);
      result = body;
    } else if (path === '/api/payments/verify') {
      const prior = claims.get(body.digest);
      const verified = !prior || prior === body.invoiceId;
      if (verified) claims.set(body.digest, body.invoiceId);
      result = {
        invoiceId: body.invoiceId,
        digest: body.digest,
        checkedAt: new Date().toISOString(),
        status: verified ? 'verified' : 'unverified',
        reason: verified ? 'Expected payment matched.' : 'Already matched to a different invoice.',
      };
    }
    await route.fulfill({ json: result });
  });
  await page.goto('/operator');
  await expect(page.getByText('Live operator', { exact: true })).toBeVisible();
  return { workspace, eventIds, invoiceIds };
}
test('new quotes never borrow an existing supplier source', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add quote', exact: true }).click();
  await expect(page.getByLabel('Quote source text')).toHaveValue('');
  await expect(page.getByLabel('Unit price (USD)')).toHaveValue('');
  await page.getByRole('combobox', { name: 'Supplier', exact: true }).selectOption('fixture-b');
  await expect(page.getByLabel('Quote source text')).toHaveValue('');
  await expect(
    page.getByRole('checkbox', {
      name: 'I checked that this quote belongs to the selected supplier',
    }),
  ).not.toBeChecked();
});
test('an accepted outcome survives a lost response and reload without duplication', async ({
  page,
}) => {
  const state = await fakeOperator(page);
  await page.getByRole('button', { name: 'Record an outcome', exact: true }).click();
  await page.getByLabel('What happened?').fill('Recorded once despite a lost response.');
  await page.getByRole('button', { name: 'Save observation', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText(/fetch|network|request/i);
  await page.reload();
  await expect(page.getByText('Live operator', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Record an outcome', exact: true }).click();
  await expect(page.getByLabel('What happened?')).toHaveValue(
    'Recorded once despite a lost response.',
  );
  await page.getByRole('button', { name: 'Save observation', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(state.eventIds).toHaveLength(2);
  expect(new Set(state.eventIds).size).toBe(1);
  expect(state.workspace.orderEvents).toHaveLength(1);
});
test('rechecking a payment reuses its invoice after reload', async ({ page }) => {
  const state = await fakeOperator(page);
  await page.getByRole('button', { name: 'Payment evidence', exact: true }).click();
  await page.getByLabel('Transaction digest').fill('D'.repeat(44));
  await page.getByLabel('Expected sender').fill('0x1');
  await page.getByLabel('Expected recipient').fill('0x2');
  await page.getByLabel('Amount in smallest units').fill('1000');
  await page.getByRole('button', { name: 'Verify payment', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Payment verified');
  await page.reload();
  await expect(page.getByText('Live operator', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Payment evidence', exact: true }).click();
  await expect(page.getByLabel('Expected sender')).toHaveValue('0x1');
  await page.getByRole('button', { name: 'Verify payment', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Payment verified');
  expect(new Set(state.invoiceIds).size).toBe(1);
});
test('blocked comparisons expose the reason for each exclusion', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Edit sourcing brief', exact: true }).click();
  await page.getByLabel('Budget (USD)').fill('100');
  await page.getByRole('button', { name: 'Save brief', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'View Northline Packaging evidence' }).click();
  await expect(page.getByText('Known total exceeds your budget.', { exact: true })).toBeVisible();
});
