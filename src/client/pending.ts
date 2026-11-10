type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
/** Persist the exact payload before sending so a lost response can be retried safely. */
export class PendingSubmission<T> {
  constructor(
    private storage: StoragePort,
    private key: string,
    private parse: (value: unknown) => T,
  ) {}
  peek(): T | null {
    try {
      const raw = this.storage.getItem(this.key);
      return raw ? this.parse(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  }
  prepare(build: () => T): T {
    const existing = this.peek();
    if (existing) return existing;
    const value = this.parse(build());
    this.storage.setItem(this.key, JSON.stringify(value));
    return value;
  }
  clear() {
    this.storage.removeItem(this.key);
  }
}
