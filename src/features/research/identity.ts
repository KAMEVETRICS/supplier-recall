import type { Supplier } from '@/domain/types';
export function safeSourceUrl(input: string): string | null {
  try {
    const u = new URL(input);
    if (
      u.protocol !== 'https:' ||
      u.username ||
      u.password ||
      u.port ||
      !u.hostname.includes('.') ||
      u.hostname.endsWith('.local') ||
      u.hostname.endsWith('.localhost') ||
      u.hostname.endsWith('.internal') ||
      u.hostname === 'localhost' ||
      /^[\d.]+$/.test(u.hostname) ||
      u.hostname.includes(':')
    )
      return null;
    u.hash = '';
    return u.href;
  } catch {
    return null;
  }
}
export function matchSupplier(candidate: Supplier, existing: Supplier[]): string | null {
  if (!candidate.identityConfirmed || !candidate.domain) return null;
  return (
    existing.find(
      (s) =>
        s.identityConfirmed && s.domain === candidate.domain && s.fictional === candidate.fictional,
    )?.id ?? null
  );
}
