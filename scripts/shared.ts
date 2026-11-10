import nextEnv from '@next/env';
import {mkdir,writeFile} from 'node:fs/promises';
import {loadConfig} from '../src/server/config';
import {ProviderError} from '../src/server/providers/http';
nextEnv.loadEnvConfig(process.cwd());
export const config=loadConfig();
export type Check={name:string;status:'pass'|'fail'|'blocked';detail:string};
export const checks:Check[]=[];
export async function check(name:string,configured:boolean,run:()=>Promise<string>){
 if(!configured){checks.push({name,status:'blocked',detail:'Required local configuration is missing.'});return;}
 try{checks.push({name,status:'pass',detail:await run()});}catch(e){checks.push({name,status:'fail',detail:e instanceof ProviderError?e.code:'Check did not pass; inspect configuration and retry.'});}
}
export async function report(name:string){await mkdir('artifacts/verification',{recursive:true});const result={checkedAt:new Date().toISOString(),checks};await writeFile(`artifacts/verification/${name}.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(checks.some(c=>c.status!=='pass'))process.exitCode=1;}
export const liveRequested=process.argv.includes('--live');
