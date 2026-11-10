import type { AuthService } from './session';
import { ProviderError } from '../providers/http';
export function sessionToken(request: Request) {
  return (
    request.headers
      .get('cookie')
      ?.split(';')
      .map((v) => v.trim())
      .find((v) => v.startsWith('recall_session='))
      ?.slice('recall_session='.length) || ''
  );
}
export function checkOrigin(request: Request, origin: string) {
  if (
    !['GET', 'HEAD', 'OPTIONS'].includes(request.method) &&
    request.headers.get('origin') !== origin
  )
    throw new ProviderError('forbidden');
}
export async function authorizeRequest(
  request: Request,
  auth: AuthService,
  origin: string,
): Promise<{ storeId: string; now: string }> {
  checkOrigin(request, origin);
  return auth.verify(sessionToken(request));
}
