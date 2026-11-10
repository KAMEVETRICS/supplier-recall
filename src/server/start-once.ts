/**
 * Runs `start` once and shares the result with every caller. A failed start is not kept, so the
 * next call tries again instead of failing forever (for example after a dropped database connection).
 */
export function startOnce<T>(start: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | undefined;
  return () =>
    (pending ??= start().catch((error: unknown) => {
      pending = undefined;
      throw error;
    }));
}
