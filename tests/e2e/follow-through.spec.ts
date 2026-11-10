import { test, expect } from '@playwright/test';
import { storeDate } from '../../src/domain/date';
test('CSV review preserves unknowns, drafts copy, and layouts stay inside the viewport', async ({
  page,
  context,
}, testInfo) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await expect(page.getByTestId('recommendation')).toContainText('Cedar Supply Co.');
  await page.screenshot({
    path: `artifacts/screenshots/${testInfo.project.name}-workbench.png`,
    fullPage: true,
  });
  const overflow = await page.evaluate(() => ({
    width: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    elements: [...document.querySelectorAll('body *')]
      .filter(
        (el) =>
          el.getBoundingClientRect().right > window.innerWidth && !el.closest('.table-scroll'),
      )
      .map((el) => ({
        tag: el.tagName,
        className: el.className,
        right: el.getBoundingClientRect().right,
      }))
      .slice(0, 12),
  }));
  expect(overflow.scrollWidth, JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.width);
  await page.getByRole('button', { name: 'Add quote', exact: true }).click();
  const csv = `supplierName,specification,quantity,currency,unitPriceCents,shippingCents,taxCents,minimumOrder,quotedAt,productionDays,transitDays,deliveryDaysKind,expiry,paymentTerms\nNorthline Packaging,"Kraft mailer, 9 × 6 × 3 in",500,USD,63,,0,250,${storeDate()},5,3,calendar,,Net 30`;
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'supplier.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await expect(page.getByLabel('Shipping cost (USD)')).toHaveValue('');
  await page.getByLabel('Unit price (USD)').fill('0.64');
  await page
    .getByRole('checkbox', { name: 'I checked that this quote belongs to the selected supplier' })
    .check();
  await page.getByRole('button', { name: 'Confirm quote', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'View Northline Packaging evidence' }).click();
  await expect(page.getByText('Delivered cost is incomplete.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Draft follow-up', exact: true }).click();
  await page.getByRole('button', { name: 'Copy draft', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Copied', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});
test('recorded outcomes survive reload and sample payments stay unverified', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Record an outcome', exact: true }).click();
  await page.getByLabel('What happened?').fill('The sample shipment arrived two days late.');
  await page.getByRole('button', { name: 'Save observation', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Order timeline', exact: true }).click();
  await expect(
    page.getByText('The sample shipment arrived two days late.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Payment evidence', exact: true }).click();
  await page.getByRole('button', { name: 'Verify payment', exact: true }).click();
  await expect(page.getByText('Payment unverified', { exact: true })).toBeVisible();
});
