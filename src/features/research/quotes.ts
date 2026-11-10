import type { ExtractedQuote } from '@/server/providers/contracts';
import { parse } from 'csv-parse/browser/esm/sync';
import { ProviderError } from '@/server/providers/http';
export function parseCsvQuotes(text: string): ExtractedQuote[] {
  if (new TextEncoder().encode(text).length > 100000) throw new ProviderError('invalid_input');
  const rows = parse(text, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    max_record_size: 100000,
  }) as Record<string, string>[];
  if (!rows.length || rows.length > 20) throw new ProviderError('invalid_input');
  return rows.map((row) => {
    const number = (key: string) => {
      if (!row[key]?.trim()) return null;
      const value = Number(row[key]);
      if (!Number.isSafeInteger(value) || value < 0) throw new ProviderError('invalid_input');
      return value;
    };
    if (!row.supplierName?.trim()) throw new ProviderError('invalid_input');
    return {
      supplierName: row.supplierName.trim(),
      specification: row.specification || null,
      quantity: number('quantity'),
      currency: row.currency || null,
      unitPriceCents: number('unitPriceCents'),
      shippingCents: number('shippingCents'),
      taxCents: number('taxCents'),
      minimumOrder: number('minimumOrder'),
      quotedAt: row.quotedAt || null,
      productionDays: number('productionDays'),
      transitDays: number('transitDays'),
      deliveryDaysKind:
        row.deliveryDaysKind === 'calendar'
          ? 'calendar'
          : row.deliveryDaysKind === 'business'
            ? 'business'
            : 'unknown',
      expiry: row.expiry || null,
      paymentTerms: row.paymentTerms || '',
    };
  });
}
