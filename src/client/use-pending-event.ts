'use client';
import { useState } from 'react';
import { PendingSubmission } from './pending';
import { EventSchema } from '@/domain/schemas';
import type { OrderEvent } from '@/domain/types';
export function usePendingEvent(key: string) {
  const [operation] = useState(
    () =>
      new PendingSubmission(sessionStorage, `supplier-recall.pending.${key}`, (value) =>
        EventSchema.parse(value),
      ),
  );
  const [pending, setPending] = useState(() => operation.peek());
  async function submit(build: () => OrderEvent, save: (event: OrderEvent) => Promise<void>) {
    const event = operation.prepare(build);
    setPending(event);
    await save(event);
    operation.clear();
    setPending(null);
  }
  return { pending, submit };
}
