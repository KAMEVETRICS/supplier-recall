import { describe, it, expect } from 'vitest';
import { PendingSubmission } from '../src/client/pending';
describe('browser operation recovery', () => {
  it('reuses the exact operation after a lost response, a retry, and a browser reload', () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => {
        data.set(k, v);
      },
      removeItem: (k: string) => {
        data.delete(k);
      },
    };
    const parse = (value: unknown) => value as { id: string; occurredAt: string };
    const first = new PendingSubmission(storage, 'event', parse);
    const initial = first.prepare(() => ({ id: 'original', occurredAt: 'first-attempt' }));
    expect(first.prepare(() => ({ id: 'wrong', occurredAt: 'retry' }))).toEqual(initial);
    const reloaded = new PendingSubmission(storage, 'event', parse);
    expect(reloaded.prepare(() => ({ id: 'wrong', occurredAt: 'reload' }))).toEqual(initial);
    reloaded.clear();
    expect(reloaded.peek()).toBeNull();
  });
});
