import { it, expect } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRepository } from '../src/server/db/repository';
import { createSampleWorkspace } from '../src/domain/fixtures';
import type { MemoryRecord } from '../src/domain/types';
import type { Providers } from '../src/server/providers/contracts';
import { MemoryService } from '../src/features/memory/service';
import { ComparisonService } from '../src/features/comparison/service';
it('recalls saved lessons and scoped corrections after closing and reopening durable storage', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'recall-loop-'));
  const config = { url: 'file:' + path.join(directory, 'loop.db').replaceAll('\\', '/') };
  let repo = await createRepository(config);
  const ctx = { storeId: 'operator', now: '2026-11-08T12:00:00Z' };
  const w = createSampleWorkspace('2026-11-08', 'operator');
  const remote = new Map<string, MemoryRecord>();
  let submits = 0;
  const providers = {
    memory: {
      health: async () => {},
      submit: async (record: MemoryRecord) => {
        submits++;
        remote.set(record.id, record);
        return { jobId: record.id };
      },
      status: async (id: string) => ({
        state: 'saved' as const,
        receipt: { blobId: 'blob-' + id },
      }),
      recall: async () => [...remote.values()],
    },
  } as unknown as Providers;
  try {
    await repo.saveBrief(ctx, w.briefs[0]);
    for (const s of w.suppliers) await repo.put(ctx, 'suppliers', s);
    for (const q of w.quotes) await repo.put(ctx, 'quotes', q);
    for (const e of w.evidence) await repo.put(ctx, 'evidence', e);
    let memory = new MemoryService(repo, providers.memory);
    for (const record of w.memories) {
      await memory.queueMemory(ctx, record);
      await memory.reconcileMemory(ctx, record.id);
    }
    repo.close();
    repo = await createRepository(config);
    memory = new MemoryService(repo, providers.memory);
    expect(
      (await new ComparisonService(repo, providers).compareBrief(ctx, w.briefs[0].id))
        .rankedSupplierIds[0],
    ).toBe('fixture-b');
    await memory.reconcileMemory(ctx, w.memories[0].id);
    expect(submits).toBe(12);
    const prior = w.memories.find((m) => m.id === 'mem-restock')!;
    const correction = {
      ...prior,
      id: 'restock-correction',
      supersedesId: prior.id,
      occurredAt: '2026-11-08T13:00:00Z',
      facts: { priority: 'price' as const },
    };
    await memory.queueMemory(ctx, correction);
    await memory.reconcileMemory(ctx, correction.id);
    await repo.saveBrief(ctx, { ...w.briefs[0], purpose: 'restock' });
    repo.close();
    repo = await createRepository(config);
    const restock = await new ComparisonService(repo, providers).compareBrief(ctx, w.briefs[0].id);
    expect(restock.rankedSupplierIds[0]).toBe('fixture-a');
    expect(restock.recalledMemoryIds).toContain('restock-correction');
    expect(restock.recalledMemoryIds).not.toContain('mem-restock');
    await repo.saveBrief(ctx, w.briefs[0]);
    expect(
      (await new ComparisonService(repo, providers).compareBrief(ctx, w.briefs[0].id))
        .rankedSupplierIds[0],
    ).toBe('fixture-b');
  } finally {
    repo.close();
  }
});
