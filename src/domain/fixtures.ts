import type { WorkspaceSnapshot, MemoryRecord, Quote } from './types';
import { storeDate } from './date';
export function dateAfter(date: string, days: number) {
  const d = new Date(`${date.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function createSampleWorkspace(today = storeDate(), storeId = 'sample'): WorkspaceSnapshot {
  // 06:00 UTC precedes Los Angeles midnight in both PST and PDT, so sample confirmations are never in
  // the future and any quote a visitor confirms later counts as the newer one.
  const now = `${today}T06:00:00Z`;
  const specification = 'Kraft mailer, 9 × 6 × 3 in';
  const brief = {
    id: 'launch-packaging',
    title: 'Packaging for the winter launch',
    specification,
    quantity: 500,
    destination: 'Portland, OR, US',
    budgetCents: 75000,
    neededBy: dateAfter(today, 18),
    purpose: 'launch' as const,
  };
  const suppliers = [
    {
      id: 'fixture-a',
      name: 'Northline Packaging',
      domain: null,
      identityConfirmed: true,
      fictional: true,
      location: 'Seattle, WA',
    },
    {
      id: 'fixture-b',
      name: 'Cedar Supply Co.',
      domain: null,
      identityConfirmed: true,
      fictional: true,
      location: 'Portland, OR',
    },
    {
      id: 'fixture-c',
      name: 'Plainfield Paper',
      domain: null,
      identityConfirmed: true,
      fictional: true,
      location: 'Sacramento, CA',
    },
  ];
  const quotes: Quote[] = suppliers.map((s, i) => ({
    id: `quote-${i + 1}`,
    supplierId: s.id,
    briefId: brief.id,
    specification,
    quantity: 500,
    currency: 'USD',
    unitPriceCents: [63, 75, 92][i],
    shippingCents: [4500, 3500, 0][i],
    taxCents: 0,
    minimumOrder: 250,
    quotedAt: today,
    productionDays: [5, 4, 7][i],
    transitDays: [3, 2, 3][i],
    deliveryDaysKind: 'calendar',
    expiry: dateAfter(today, 30),
    paymentTerms: 'Net 30. Quote subject to written confirmation.',
    evidenceIds: [`evidence-${i + 1}`],
    confirmedAt: now,
  }));
  const evidence = suppliers.map((s, i) => ({
    id: `evidence-${i + 1}`,
    supplierId: s.id,
    kind: 'quote' as const,
    source: `Sample quote ${i + 1}`,
    retrievedAt: now,
    excerpt: `Fictional quote: 500 ${specification}; USD ${(quotes[i].unitPriceCents ?? 0) / 100} each; freight USD ${(quotes[i].shippingCents ?? 0) / 100}; tax USD 0. Production ${quotes[i].productionDays} calendar days plus ${quotes[i].transitDays} transit days.`,
    fictional: true,
  }));
  const make = (
    id: string,
    kind: MemoryRecord['kind'],
    text: string,
    supplierId: string | null,
    facts: MemoryRecord['facts'],
    daysAgo: number,
    purpose: MemoryRecord['purpose'] = null,
  ): MemoryRecord => ({
    id,
    storeId,
    kind,
    text,
    supplierId,
    facts,
    purpose,
    occurredAt: `${dateAfter(today, -daysAgo)}T12:00:00Z`,
    evidenceIds: supplierId ? [evidence[suppliers.findIndex((s) => s.id === supplierId)].id] : [],
    supersedesId: null,
  });
  const memories = [
    make(
      'mem-launch',
      'preference',
      'For launches, dependable delivery matters more than the lowest price.',
      null,
      { priority: 'reliability' },
      45,
      'launch',
    ),
    make(
      'mem-restock',
      'preference',
      'Until we learn more, prefer dependable suppliers for restocks too.',
      null,
      { priority: 'reliability' },
      44,
      'restock',
    ),
    make(
      'mem-a-delay-1',
      'outcome',
      'Northline promised 8 days; the order arrived in 13 days. Five days late.',
      'fixture-a',
      { promisedDays: 8, actualDays: 13 },
      35,
    ),
    make(
      'mem-a-delay-2',
      'outcome',
      'The second Northline order arrived in 12 days against an 8-day promise.',
      'fixture-a',
      { promisedDays: 8, actualDays: 12 },
      18,
    ),
    make(
      'mem-b-delivery',
      'outcome',
      'Cedar delivered the last order in 6 days, exactly as promised.',
      'fixture-b',
      { promisedDays: 6, actualDays: 6 },
      12,
    ),
    make(
      'mem-b-quality',
      'outcome',
      'Cedar sample packaging passed our packing test.',
      'fixture-b',
      { qualityIssue: false },
      11,
    ),
    make(
      'mem-a-quality',
      'outcome',
      'One Northline carton had crushed corners; replacement requested.',
      'fixture-a',
      { qualityIssue: true, resolved: false },
      18,
    ),
    make(
      'mem-c-research',
      'research',
      'Plainfield offers the requested kraft size in its sample quote. Delivery performance is unknown.',
      'fixture-c',
      {},
      9,
    ),
    make(
      'mem-b-research',
      'research',
      'Cedar is local to the store in this fictional scenario; the written quote includes freight.',
      'fixture-b',
      {},
      8,
    ),
    make(
      'mem-commitment',
      'commitment',
      'Ask Cedar to confirm the production slot before placing the launch order.',
      'fixture-b',
      {},
      3,
    ),
    make(
      'mem-decision',
      'decision',
      'Cedar was shortlisted for the launch based on the observed on-time delivery.',
      'fixture-b',
      {},
      2,
    ),
    make(
      'mem-resolution',
      'outcome',
      'Northline acknowledged the damaged carton; replacement is still outstanding.',
      'fixture-a',
      { resolved: false },
      1,
    ),
  ];
  return {
    briefs: [brief],
    suppliers,
    evidence,
    quotes,
    memories,
    memoryWrites: memories.map((m) => ({
      recordId: m.id,
      operationKey: `sample:${m.id}`,
      jobId: null,
      state: 'saved',
      receipt: { sample: true },
      errorCode: null,
    })),
    orderEvents: [],
    invoices: [],
    paymentChecks: [],
  };
}
