import { describe, it, expect } from 'vitest';
import { startOnce } from '../src/server/start-once';

describe('server startup', () => {
  it('retries after a failed start, then reuses the successful one', async () => {
    let calls = 0;
    const get = startOnce(async () => {
      calls++;
      if (calls === 1) throw new Error('database unreachable');
      return { ready: calls };
    });
    await expect(get()).rejects.toThrow('database unreachable');
    const started = await get();
    expect(started).toEqual({ ready: 2 });
    expect(await get()).toBe(started);
    expect(calls).toBe(2);
  });

  it('shares one start between concurrent callers', async () => {
    let calls = 0;
    const get = startOnce(async () => ++calls);
    expect(await Promise.all([get(), get(), get()])).toEqual([1, 1, 1]);
    expect(calls).toBe(1);
  });
});
