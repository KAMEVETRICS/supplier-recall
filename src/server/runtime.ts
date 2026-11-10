import 'server-only';
import { loadConfig } from './config';
import { createRepository } from './db/repository';
import { createProviders } from './providers';
import { AuthService } from './auth/session';
import { startOnce } from './start-once';
async function initialize() {
  const config = loadConfig();
  const repo = await createRepository({ url: config.databaseUrl, authToken: config.databaseToken });
  return { config, repo, providers: createProviders(config), auth: new AuthService(repo, config) };
}
export const getRuntime = startOnce(initialize);
