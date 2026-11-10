import 'server-only';
import {loadConfig} from './config';
import {createRepository} from './db/repository';
import {createProviders} from './providers';
import {AuthService} from './auth/session';
let instance:ReturnType<typeof initialize>|undefined;
async function initialize(){const config=loadConfig();const repo=await createRepository({url:config.databaseUrl,authToken:config.databaseToken});return {config,repo,providers:createProviders(config),auth:new AuthService(repo,config)};}
export function getRuntime(){return instance??=initialize();}
