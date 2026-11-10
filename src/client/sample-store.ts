import {
  BriefSchema,
  QuoteSchema,
  MemorySchema,
  SupplierSchema,
  EvidenceSchema,
  EventSchema,
} from '@/domain/schemas';
import type { WorkspaceSnapshot, OrderEvent, MemoryRecord } from '@/domain/types';
const key = 'supplier-recall.sample.v1';
export function readSample(): WorkspaceSnapshot | null {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || 'null');
    if (!raw || raw.version !== 1) return null;
    const w = raw.workspace as WorkspaceSnapshot;
    if (
      !w.briefs.every((b) => BriefSchema.safeParse(b).success) ||
      !w.quotes.every((q) => QuoteSchema.safeParse(q).success) ||
      !w.memories.every((m) => MemorySchema.safeParse(m).success) ||
      !w.suppliers.every((s) => SupplierSchema.safeParse(s).success) ||
      !w.evidence.every((e) => EvidenceSchema.safeParse(e).success) ||
      !w.orderEvents.every((e) => EventSchema.safeParse(e).success) ||
      !Array.isArray(w.memoryWrites)
    )
      return null;
    return w;
  } catch {
    return null;
  }
}
export function writeSample(workspace: WorkspaceSnapshot) {
  localStorage.setItem(key, JSON.stringify({ version: 1, workspace }));
}
export function applySampleEvent(w: WorkspaceSnapshot, input: OrderEvent): WorkspaceSnapshot {
  const event = EventSchema.parse(input);
  if (w.orderEvents.some((e) => e.id === event.id)) return w;
  const record: MemoryRecord = {
    id: `event-${event.id}`,
    storeId: 'sample',
    supplierId: event.kind === 'correction' ? null : event.supplierId,
    kind:
      event.kind === 'correction'
        ? 'preference'
        : event.kind === 'delivery' || event.kind === 'quality'
          ? 'outcome'
          : event.kind,
    purpose: event.kind === 'correction' ? (event.purpose ?? null) : null,
    text: event.text,
    occurredAt: event.occurredAt,
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
  return {
    ...w,
    orderEvents: [...w.orderEvents, event],
    memories: [...w.memories, MemorySchema.parse(record)],
    memoryWrites: [
      ...w.memoryWrites,
      {
        recordId: record.id,
        operationKey: `sample:${record.id}`,
        jobId: null,
        state: 'saved',
        receipt: { sample: true },
        errorCode: null,
      },
    ],
  };
}
