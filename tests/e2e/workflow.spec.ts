import { test, expect } from '@playwright/test';
test('sample decisions change with memory and scoped corrections survive reload', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your sourcing desk' })).toBeVisible();
  await expect(page.getByText('Sample data', { exact: true })).toBeVisible();
  await expect(page.getByTestId('recommendation')).toContainText('Cedar Supply Co.');
  await page.getByRole('checkbox', { name: 'Use remembered experience' }).uncheck();
  await expect(page.getByTestId('recommendation')).toContainText('Northline Packaging');
  await page.getByRole('checkbox', { name: 'Use remembered experience' }).check();
  await page.getByLabel('Purchase purpose').selectOption('restock');
  await expect(page.getByTestId('recommendation')).toContainText('Cedar Supply Co.');
  await page.getByRole('button', { name: 'Memory', exact: true }).click();
  await page.getByRole('button', { name: 'Teach a preference' }).click();
  await page.getByLabel('Preference priority').selectOption('price');
  await page.getByRole('button', { name: 'Save preference', exact: true }).click();
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await expect(page.getByTestId('recommendation')).toContainText('Northline Packaging');
  await page.reload();
  await expect(page.getByTestId('recommendation')).toContainText('Northline Packaging');
});
test('quote review, research and draft paths work without paid provider calls', async ({
  page,
}) => {
  const apiRequests: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/')) apiRequests.push(r.url());
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Add quote', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page
    .getByLabel('Quote source text')
    .fill('User-entered fictional quote; shipping not provided.');
  await page
    .getByRole('checkbox', { name: 'I checked that this quote belongs to the selected supplier' })
    .check();
  await page.getByLabel('Shipping cost (USD)').fill('');
  await page.getByRole('button', { name: 'Confirm quote', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Research suppliers', exact: true }).click();
  await expect(page.getByText('Discovery preview', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Draft follow-up', exact: true }).click();
  await expect(page.getByLabel('Draft message')).toHaveValue(/Hi /);
  expect(apiRequests).toHaveLength(0);
});
test('public live API access is denied', async ({ request }) => {
  const response = await request.get('/api/workspace');
  expect(response.status()).toBe(401);
});
