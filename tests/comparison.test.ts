import { describe, it, expect, vi } from 'vitest';
import { compareEvidence } from '../src/features/comparison/engine';
import { createSampleWorkspace } from '../src/domain/fixtures';
import { validateDraft, templateDraft } from '../src/features/comparison/drafts';
import { ComparisonService } from '../src/features/comparison/service';
import type { Repository } from '../src/server/db/repository';
import type { Providers } from '../src/server/providers/contracts';
const data = createSampleWorkspace('2026-11-08');
const brief = data.briefs[0];
const recall = { memories: data.memories, status: 'complete' as const, missingActiveIds: [] };
describe('supplier decisions', () => {
  it('keeps a price comparison provisional when a competitor has unknown freight', () => {
    const result = compareEvidence(
      { ...brief, purpose: 'restock' },
      [{ ...data.quotes[0], shippingCents: null }, ...data.quotes.slice(1)],
      data.evidence,
      { ...recall, memories: [] },
      '2026-11-08',
    );
    expect(result.status).toBe('provisional');
  });
  it('treats a quote confirmed just after Los Angeles midnight as newer than the sample quotes', () => {
    vi.useFakeTimers();
    try {
      for (const instant of ['2026-11-10T08:05:00Z', '2026-07-10T07:05:00Z']) {
        vi.setSystemTime(new Date(instant));
        const w = createSampleWorkspace();
        const fresh = {
          ...w.quotes[0],
          id: 'fresh',
          shippingCents: null,
          confirmedAt: new Date().toISOString(),
        };
        expect(
          compareEvidence(
            w.briefs[0],
            [...w.quotes, fresh],
            w.evidence,
            { memories: [], status: 'complete', missingActiveIds: [] },
            instant,
          ).candidates.find((c) => c.supplierId === 'fixture-a')?.totalCents,
          instant,
        ).toBeNull();
      }
    } finally {
      vi.useRealTimers();
    }
  });
  it('keeps generated sample quotes valid across the UTC/local midnight boundary', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-11-09T07:30:00Z'));
      const w = createSampleWorkspace();
      expect(
        compareEvidence(
          w.briefs[0],
          w.quotes,
          w.evidence,
          { memories: w.memories, status: 'complete', missingActiveIds: [] },
          new Date().toISOString(),
        ).status,
      ).toBe('ready');
    } finally {
      vi.useRealTimers();
    }
  });
  it('does not allow invented promises even when their citation IDs are valid', async () => {
    const comparison = compareEvidence(brief, data.quotes, data.evidence, recall, '2026-11-08');
    const providers = {
      llm: {
        draft: async () => ({
          text: 'We guarantee delivery tomorrow for $1.',
          evidenceIds: [],
          memoryIds: [],
        }),
      },
    } as unknown as Providers;
    const input = { comparison, supplierName: 'Cedar', commitments: [] };
    expect(
      await new ComparisonService({} as Repository, providers).draftFollowUp(
        { storeId: 'sample', now: '2026-11-08' },
        input,
      ),
    ).toEqual(templateDraft(input));
  });
  it('changes a launch decision when prior late deliveries are recalled', () => {
    expect(
      compareEvidence(brief, data.quotes, data.evidence, { ...recall, memories: [] }, '2026-11-08')
        .rankedSupplierIds[0],
    ).toBe('fixture-a');
    expect(
      compareEvidence(brief, data.quotes, data.evidence, recall, '2026-11-08').rankedSupplierIds[0],
    ).toBe('fixture-b');
  });
  it('applies a restock correction only to restocks', () => {
    const prior = data.memories.find((m) => m.id === 'mem-restock')!;
    const corrected = {
      ...recall,
      memories: [
        ...recall.memories,
        {
          ...prior,
          id: 'new-preference',
          supersedesId: prior.id,
          occurredAt: '2026-11-08T13:00:00Z',
          facts: { priority: 'price' as const },
        },
      ],
    };
    expect(
      compareEvidence(
        { ...brief, purpose: 'restock' },
        data.quotes,
        data.evidence,
        corrected,
        '2026-11-08',
      ).rankedSupplierIds[0],
    ).toBe('fixture-a');
    expect(
      compareEvidence(brief, data.quotes, data.evidence, corrected, '2026-11-08')
        .rankedSupplierIds[0],
    ).toBe('fixture-b');
  });
  it('does not call an incomplete quote cheapest or complete', () => {
    const q = { ...data.quotes[0], shippingCents: null };
    const result = compareEvidence(brief, [q], data.evidence, recall, '2026-11-08');
    expect(result.status).toBe('provisional');
    expect(result.candidates[0].totalCents).toBeNull();
    expect(result.questions.join(' ')).toMatch(/shipping/i);
  });
  it('excludes expired quotes and non-equivalent specifications', () => {
    const quotes = [
      { ...data.quotes[0], expiry: '2026-11-07' },
      { ...data.quotes[1], specification: 'Plastic bag' },
    ];
    expect(
      compareEvidence(brief, quotes, data.evidence, recall, '2026-11-08').rankedSupplierIds,
    ).toHaveLength(0);
  });
  it('marks unavailable memory provisional and never invents memory IDs', () => {
    const result = compareEvidence(
      brief,
      data.quotes,
      data.evidence,
      { memories: [], status: 'unavailable', missingActiveIds: [] },
      '2026-11-08',
    );
    expect(result.status).toBe('provisional');
    expect(result.recalledMemoryIds).toHaveLength(0);
  });
  it('anchors delivery to the new order date and asks about business days', () => {
    const old = { ...data.quotes[0], quotedAt: '2026-10-01' };
    const r = compareEvidence(brief, [old], data.evidence, recall, '2026-11-08');
    expect(r.candidates[0].arrival).toBe('2026-11-16');
    expect(
      compareEvidence(
        brief,
        [{ ...old, deliveryDaysKind: 'business' }],
        data.evidence,
        recall,
        '2026-11-08',
      ).candidates[0].arrival,
    ).toBeNull();
  });
  it('rejects invented draft citations', () => {
    const comparison = compareEvidence(brief, data.quotes, data.evidence, recall, '2026-11-08');
    expect(
      validateDraft({ text: 'Hello', evidenceIds: ['invented'], memoryIds: [] }, comparison),
    ).toBe(false);
    expect(templateDraft({ comparison, supplierName: 'Cedar', commitments: [] }).text).toContain(
      'Cedar',
    );
  });
});
