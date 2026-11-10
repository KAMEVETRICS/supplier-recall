import { createHash } from 'node:crypto';
import { getRuntime } from '@/server/runtime';
import { json, respondError } from '@/server/http';
import { loginSource } from '@/server/auth/source';
import { buildLiveProof, type LiveProof } from '@/features/proof/live';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Public and read-only. Fresh checks call Walrus and Tatum, so they are cached briefly and rate-limited
// per visitor (hashed source, never the raw IP) and overall.
const cacheMs = 60_000;
let cached: { at: number; proof: LiveProof } | undefined;
let inFlight: Promise<LiveProof> | undefined;
export async function GET(request: Request) {
  try {
    const r = await getRuntime();
    if (cached && Date.now() - cached.at < cacheMs) return json(cached.proof);
    const visitor = createHash('sha256')
      .update(loginSource(request, r.config))
      .digest('hex')
      .slice(0, 24);
    await r.auth.reserve(`live:${visitor}`, 'proof', 20);
    await r.auth.reserve('live', 'proof-all', 300);
    inFlight ??= buildLiveProof(r.repo, r.providers, r.config).finally(() => {
      inFlight = undefined;
    });
    const proof = await inFlight;
    cached = { at: Date.now(), proof };
    return json(proof);
  } catch (e) {
    return respondError(e);
  }
}
