import Workbench from '@/components/workbench';
import { createSampleWorkspace } from '@/domain/fixtures';
import { loadConfig } from '@/server/config';
export const dynamic = 'force-dynamic';
export default function Operator() {
  const c = loadConfig();
  return (
    <Workbench
      initial={createSampleWorkspace()}
      operator
      liveConfigured={c.mode === 'live' && !!c.passwordHash && c.sessionSecret.length >= 32}
    />
  );
}
