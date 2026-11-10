import {MemWal} from '@mysten-incubation/memwal';
import {z} from 'zod';
import {MemorySchema} from '@/domain/schemas';
import type {MemoryRecord} from '@/domain/types';
import type {AppConfig} from '@/server/config';
import type {MemoryJobStatus,MemoryProvider} from './contracts';
import {ProviderError} from './http';
const jobSchema=z.object({job_id:z.string(),status:z.enum(['pending','running','uploaded','done','failed','not_found']),blob_id:z.string().optional(),namespace:z.string().optional()});
export function normalizeJob(job:unknown):MemoryJobStatus{const parsed=jobSchema.safeParse(job);if(!parsed.success)throw new ProviderError('invalid_response');const j=parsed.data;if(j.status==='done'&&j.blob_id)return {state:'saved',receipt:{jobId:j.job_id,blobId:j.blob_id,namespace:j.namespace??null}};if(j.status==='failed'||j.status==='not_found')return {state:'failed',errorCode:'memory_job_failed'};return {state:'accepted'};}
export function decodeMemory(text:string):MemoryRecord|null{try{const envelope=JSON.parse(text);if(envelope.version!==1)return null;const parsed=MemorySchema.safeParse(envelope.record);return parsed.success?parsed.data:null;}catch{return null;}}
export function createWalrus(config:AppConfig):MemoryProvider{
  let client:MemWal|undefined;
  function get(){if(!config.memwalKey||!config.memwalAccount)throw new ProviderError('not_configured');if(config.memwalUrl!=='https://relayer.memory.walrus.xyz')throw new ProviderError('mainnet_required');return client??=MemWal.create({key:config.memwalKey,accountId:config.memwalAccount,serverUrl:config.memwalUrl,namespace:config.namespace,requestTimeoutMs:30000});}
  async function safe<T>(fn:()=>Promise<T>):Promise<T>{try{return await fn();}catch(e){if(e instanceof ProviderError)throw e;const message=e instanceof Error?e.message:'';throw new ProviderError(/429|rate.?limit/i.test(message)?'rate_limited':/401|403|auth/i.test(message)?'unauthorized':/timeout/i.test(message)?'timeout':'unavailable');}}
  return {health:()=>safe(async()=>{await get().health();}),submit:(record,key)=>safe(async()=>{const job=await get().remember(JSON.stringify({version:1,record:MemorySchema.parse(record)}),{idempotencyKey:key});return {jobId:job.job_id};}),status:jobId=>safe(async()=>normalizeJob(await get().getRememberStatus(jobId))),recall:(query,limit)=>safe(async()=>{const response=await get().recall({query,limit,namespace:config.namespace});return response.results.map(hit=>decodeMemory(hit.text)).filter((v):v is MemoryRecord=>v!==null);})};
}
