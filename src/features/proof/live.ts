import { readFile } from 'node:fs/promises';
import type { Brief, Comparison, Context, Invoice, RecallResult } from '@/domain/types';
import { InvoiceSchema } from '@/domain/schemas';
import type { Repository } from '@/server/db/repository';
import type { Providers } from '@/server/providers/contracts';
import type { AppConfig } from '@/server/config';
import { ProviderError } from '@/server/providers/http';
import { MemoryService } from '@/features/memory/service';
import { compareEvidence } from '@/features/comparison/engine';
import { matchTransaction } from '@/features/orders/payments';

export interface LiveDecision {
  label: string;
  purpose: Brief['purpose'];
  usesMemory: boolean;
  status: Comparison['status'];
  memoryStatus: Comparison['memoryStatus'];
  recalledMemoryIds: string[];
  rankedSupplierIds: string[];
  reasons: Comparison['reasons'];
}
export interface LiveMemory {
  id: string;
  kind: string;
  purpose: string | null;
  supplierId: string | null;
  text: string;
  occurredAt: string;
  supersededBy: string | null;
  state: string;
  blobId: string | null;
}
export type LivePayment =
  | { state: 'not_configured' }
  | { state: 'invalid_configuration'; reason: string }
  | { state: 'lookup_failed'; digest: string; reason: string }
  | {
      state: 'checked';
      digest: string;
      invoice: { sender: string; recipient: string; assetType: string; amountAtomic: string };
      match: { verified: boolean; reason: string };
      mismatch: { amountAtomic: string; verified: boolean; reason: string };
    };
export interface LiveProof {
  checkedAt: string;
  namespace: string;
  suppliers: { id: string; name: string }[];
  memories: LiveMemory[];
  decisions: LiveDecision[];
  payment: LivePayment;
}

// The public proof reads the operator workspace but shows only its fictional demo scenario:
// fictional suppliers' quotes and memories, plus purchase-purpose preferences. Real suppliers never appear.
const store = 'operator';

/** Read-only: recalls memories from Walrus and reads one transaction through Tatum. Writes nothing. */
export async function buildLiveProof(
  repo: Repository,
  providers: Providers,
  config: AppConfig,
  now = new Date().toISOString(),
): Promise<LiveProof> {
  const ctx: Context = { storeId: store, now };
  const w = await repo.getWorkspace(ctx);
  const brief = w.briefs[0];
  if (!brief) throw new ProviderError('not_found');
  const fictional = new Set(
    w.suppliers.filter((s) => s.fictional && s.identityConfirmed).map((s) => s.id),
  );
  const quotes = w.quotes.filter((q) => q.briefId === brief.id && fictional.has(q.supplierId));
  const evidence = w.evidence.filter((e) => fictional.has(e.supplierId));
  const supplierIds = [...new Set(quotes.map((q) => q.supplierId))];
  const memory = new MemoryService(repo, providers.memory);
  const [launch, restock, payment] = await Promise.all([
    memory.recallForBrief(ctx, { ...brief, purpose: 'launch' }, supplierIds),
    memory.recallForBrief(ctx, { ...brief, purpose: 'restock' }, supplierIds),
    checkSamplePayment(providers, config),
  ]);
  const decide = (
    label: string,
    purpose: Brief['purpose'],
    recall: RecallResult,
    usesMemory: boolean,
  ): LiveDecision => {
    const c = compareEvidence({ ...brief, purpose }, quotes, evidence, recall, now);
    return {
      label,
      purpose,
      usesMemory,
      status: c.status,
      memoryStatus: c.memoryStatus,
      recalledMemoryIds: c.recalledMemoryIds,
      rankedSupplierIds: c.rankedSupplierIds,
      reasons: c.reasons,
    };
  };
  const supersededBy = new Map(
    w.memories.filter((m) => m.supersedesId).map((m) => [m.supersedesId as string, m.id]),
  );
  const writes = new Map(w.memoryWrites.map((j) => [j.recordId, j]));
  const shown = w.memories.filter((m) =>
    m.supplierId === null ? m.kind === 'preference' : fictional.has(m.supplierId),
  );
  return {
    checkedAt: now,
    namespace: config.namespace,
    suppliers: w.suppliers
      .filter((s) => fictional.has(s.id))
      .map((s) => ({ id: s.id, name: s.name })),
    memories: shown
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
      .map((m) => {
        const job = writes.get(m.id);
        const blobId = job?.receipt?.blobId;
        return {
          id: m.id,
          kind: m.kind,
          purpose: m.purpose,
          supplierId: m.supplierId,
          text: m.text,
          occurredAt: m.occurredAt,
          supersededBy: supersededBy.get(m.id) ?? null,
          state: job?.state ?? 'pending',
          blobId: typeof blobId === 'string' ? blobId : null,
        };
      }),
    decisions: [
      decide(
        'Quotes only',
        'launch',
        { memories: [], status: 'complete', missingActiveIds: [] },
        false,
      ),
      decide('Product launch, with recalled memory', 'launch', launch, true),
      decide('Routine restock, with recalled memory', 'restock', restock, true),
    ],
    payment,
  };
}

/** Deployments pass the invoice as JSON; local runs may point at a private file instead. */
async function loadSampleInvoice(config: AppConfig): Promise<Invoice | null> {
  const raw =
    config.sampleInvoiceJson ||
    (config.sampleInvoicePath ? await readFile(config.sampleInvoicePath, 'utf8') : '');
  return raw ? InvoiceSchema.parse(JSON.parse(raw)) : null;
}

async function checkSamplePayment(providers: Providers, config: AppConfig): Promise<LivePayment> {
  if (!config.sampleDigest) return { state: 'not_configured' };
  let invoice: Invoice | null;
  try {
    invoice = await loadSampleInvoice(config);
  } catch {
    return {
      state: 'invalid_configuration',
      reason: 'The sample invoice is missing or malformed.',
    };
  }
  if (!invoice) return { state: 'not_configured' };
  try {
    const tx = await providers.payment.lookup(config.sampleDigest);
    const failure = matchTransaction(invoice, tx);
    const wrongAmount = (BigInt(invoice.amountAtomic) + 1n).toString();
    const mismatch = matchTransaction({ ...invoice, amountAtomic: wrongAmount }, tx);
    return {
      state: 'checked',
      digest: config.sampleDigest,
      invoice: {
        sender: invoice.expectedSender,
        recipient: invoice.expectedRecipient,
        assetType: invoice.assetType,
        amountAtomic: invoice.amountAtomic,
      },
      match: {
        verified: failure === null,
        reason:
          failure ??
          'Execution, sender, recipient, asset, and amount match. This does not prove delivery.',
      },
      mismatch: {
        amountAtomic: wrongAmount,
        verified: mismatch === null,
        reason: mismatch ?? 'The changed amount unexpectedly matched.',
      },
    };
  } catch (error) {
    return {
      state: 'lookup_failed',
      digest: config.sampleDigest,
      reason:
        error instanceof ProviderError
          ? `Payment lookup ${error.code.replaceAll('_', ' ')}.`
          : 'Payment lookup failed.',
    };
  }
}
