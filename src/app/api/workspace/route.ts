import { getRuntime } from '@/server/runtime';
import { authorizeRequest } from '@/server/auth/guard';
import { json, respondError } from '@/server/http';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  try {
    const { repo, auth, config } = await getRuntime();
    const ctx = await authorizeRequest(request, auth, config.origin);
    return json(await repo.getWorkspace(ctx));
  } catch (e) {
    return respondError(e);
  }
}
