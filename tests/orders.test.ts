import { describe, it, expect } from 'vitest';
import { matchTransaction, verifyInvoicePayment } from '../src/features/orders/payments';
import { recordOrderEvent } from '../src/features/orders/service';
import { createRepository } from '../src/server/db/repository';
import { createSampleWorkspace } from '../src/domain/fixtures';
import type { TransactionEvidence, MemoryProvider } from '../src/server/providers/contracts';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const invoice = {
  id: 'invoice-1',
  supplierId: 'fixture-b',
  expectedSender: '0x1',
  expectedRecipient: '0x2',
  assetType: '0x2::sui::SUI',
  amountAtomic: '1000',
};
const tx: TransactionEvidence = {
  digest: 'D'.repeat(44),
  checkpoint: '123',
  effects: {
    status: { status: 'success' },
    gasUsed: { computationCost: '20', storageCost: '10', storageRebate: '5' },
  },
  transaction: {
    data: {
      sender: '0x1',
      gasData: { owner: '0x1' },
      transaction: {
        kind: 'ProgrammableTransaction',
        transactions: [{ SplitCoins: [] }, { TransferObjects: [] }],
      },
    },
  },
  balanceChanges: [
    { owner: { AddressOwner: '0x1' }, coinType: '0x2::sui::SUI', amount: '-1025' },
    { owner: { AddressOwner: '0x2' }, coinType: '0x2::sui::SUI', amount: '1000' },
  ],
};
const context = { storeId: 'operator', now: '2026-11-08T12:00:00Z' };
async function repository() {
  const dir = await mkdtemp(path.join(tmpdir(), 'recall-orders-'));
  return createRepository({ url: `file:${path.join(dir, 'test.db').replaceAll('\\', '/')}` });
}
describe('outcomes and payment evidence', () => {
  it('matches a simple transfer after accounting for gas', () =>
    expect(matchTransaction(invoice, tx)).toBeNull());
  it.each([
    { expectedRecipient: '0x3' },
    { expectedSender: '0x3' },
    { amountAtomic: '999' },
    { assetType: '0x2::coin::OTHER' },
  ])('rejects an invoice mismatch %j', (edit) =>
    expect(matchTransaction({ ...invoice, ...edit }, tx)).not.toBeNull(),
  );
  it('rejects unconfirmed execution and complex transaction semantics', () => {
    expect(matchTransaction(invoice, { ...tx, checkpoint: undefined })).not.toBeNull();
    expect(
      matchTransaction(invoice, {
        ...tx,
        transaction: {
          data: {
            ...tx.transaction!.data!,
            transaction: { kind: 'ProgrammableTransaction', transactions: [{ MoveCall: {} }] },
          },
        },
      }),
    ).not.toBeNull();
  });
  it('atomically prevents one digest from paying two invoices', async () => {
    const repo = await repository();
    await repo.put(context, 'invoices', invoice);
    await repo.put(context, 'invoices', { ...invoice, id: 'invoice-2' });
    const checks = await Promise.all([
      verifyInvoicePayment(repo, { lookup: async () => tx }, context, 'invoice-1', tx.digest),
      verifyInvoicePayment(repo, { lookup: async () => tx }, context, 'invoice-2', tx.digest),
    ]);
    expect(checks.filter((c) => c.status === 'verified')).toHaveLength(1);
    repo.close();
  });
  it('persists an order observation with its pending memory atomically', async () => {
    const repo = await repository();
    const sample = createSampleWorkspace('2026-11-08', 'operator');
    await repo.saveBrief(context, sample.briefs[0]);
    await repo.put(context, 'suppliers', sample.suppliers[1]);
    const provider: MemoryProvider = {
      health: async () => {},
      submit: async () => ({ jobId: 'j' }),
      status: async () => ({ state: 'accepted' }),
      recall: async () => [],
    };
    const result = await recordOrderEvent(repo, provider, context, {
      id: 'event-1',
      briefId: sample.briefs[0].id,
      supplierId: 'fixture-b',
      kind: 'delivery',
      occurredAt: context.now,
      text: 'Delivered on time',
      promisedDays: 6,
      actualDays: 6,
      evidenceIds: [],
    });
    expect(result.memory.state).toBe('pending');
    expect((await repo.getWorkspace(context)).orderEvents).toHaveLength(1);
    repo.close();
  });
});
