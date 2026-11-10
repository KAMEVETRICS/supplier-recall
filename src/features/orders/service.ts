import type {
  Context,
  OrderEvent,
  MemoryWrite,
  MemoryRecord,
  Supplier,
  Evidence,
} from '@/domain/types';
import type { MemoryProvider } from '@/server/providers/contracts';
import type { Repository } from '@/server/db/repository';
import { EventSchema } from '@/domain/schemas';
import { MemoryService } from '@/features/memory/service';
import { ProviderError } from '@/server/providers/http';
export async function recordOrderEvent(
  repo: Repository,
  provider: MemoryProvider,
  ctx: Context,
  input: OrderEvent,
): Promise<{ event: OrderEvent; memory: MemoryWrite }> {
  const event = EventSchema.parse(input);
  if (
    !(await repo.getBrief(ctx, event.briefId)) ||
    !(await repo.get<Supplier>(ctx, 'suppliers', event.supplierId))
  )
    throw new ProviderError('not_found');
  for (const id of event.evidenceIds) {
    const evidence = await repo.get<Evidence>(ctx, 'evidence', id);
    if (!evidence || evidence.supplierId !== event.supplierId)
      throw new ProviderError('invalid_input');
  }
  const record: MemoryRecord = {
    id: `event-${event.id}`,
    storeId: ctx.storeId,
    supplierId: event.kind === 'correction' ? null : event.supplierId,
    kind:
      event.kind === 'correction'
        ? 'preference'
        : event.kind === 'delivery' || event.kind === 'quality'
          ? 'outcome'
          : event.kind,
    text: event.text,
    occurredAt: event.occurredAt,
    purpose: event.kind === 'correction' ? (event.purpose ?? null) : null,
    evidenceIds: event.evidenceIds,
    supersedesId: event.supersedesId ?? null,
    facts: {
      ...(event.priority ? { priority: event.priority } : {}),
      ...(event.kind === 'delivery'
        ? { promisedDays: event.promisedDays, actualDays: event.actualDays }
        : {}),
      ...(event.kind === 'quality' ? { qualityIssue: true, resolved: false } : {}),
    },
  };
  const tx = await repo.db.transaction('write');
  try {
    const existing = await repo.get<OrderEvent>(ctx, 'orderEvents', event.id, tx);
    if (existing && JSON.stringify(existing) !== JSON.stringify(event))
      throw new ProviderError('conflict');
    await repo.put(ctx, 'orderEvents', event, tx);
    const memory = await new MemoryService(repo, provider).queueMemory(ctx, record, tx);
    await tx.commit();
    return { event, memory };
  } catch (e) {
    await tx.rollback();
    throw e;
  } finally {
    tx.close();
  }
}
