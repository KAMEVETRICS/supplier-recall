import nextEnv from '@next/env';
import { createRepository } from '../src/server/db/repository';
import { loadConfig } from '../src/server/config';
nextEnv.loadEnvConfig(process.cwd());
const config = loadConfig();
const repo = await createRepository({ url: config.databaseUrl, authToken: config.databaseToken });
repo.close();
console.log('Database schema ready.');
