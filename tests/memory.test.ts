import {beforeEach,afterEach,describe,it,expect} from 'vitest';
import {createRepository,type Repository} from '../src/server/db/repository';
import {MemoryService} from '../src/features/memory/service';
import {createSampleWorkspace} from '../src/domain/fixtures';
import type {MemoryProvider} from '../src/server/providers/contracts';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
const ctx={storeId:'operator',now:'2026-11-08T12:00:00Z'};let repo:Repository;
beforeEach(async()=>{const dir=await mkdtemp(path.join(tmpdir(),'recall-memory-'));repo=await createRepository({url:`file:${path.join(dir,'test.db').replaceAll('\\','/')}`});});afterEach(()=>repo.close());
const provider=(overrides:Partial<MemoryProvider>={}):MemoryProvider=>({health:async()=>{},submit:async()=>({jobId:'job-1'}),status:async()=>({state:'accepted'}),recall:async()=>[],...overrides});
describe('durable memory lifecycle',()=>{
 it('persists one operation across duplicate queue calls and a new service instance',async()=>{const m=createSampleWorkspace('2026-11-08','operator').memories[0];const s=new MemoryService(repo,provider());const a=await s.queueMemory(ctx,m);const b=await s.queueMemory(ctx,m);expect(a.operationKey).toBe(b.operationKey);expect((await repo.getWorkspace(ctx)).memoryWrites).toHaveLength(1);expect((await new MemoryService(repo,provider()).reconcileMemory(ctx,m.id)).state).toBe('accepted');});
 it('requires completion receipt before declaring storage saved',async()=>{const m=createSampleWorkspace('2026-11-08','operator').memories[0];const service=new MemoryService(repo,provider({status:async()=>({state:'saved',receipt:{blobId:'real-blob'}})}));await service.queueMemory(ctx,m);expect((await service.reconcileMemory(ctx,m.id)).receipt).toEqual({blobId:'real-blob'});});
 it('filters superseded preferences even when retrieval misses the correction',async()=>{const data=createSampleWorkspace('2026-11-08','operator');const prior=data.memories[1];const correction={...prior,id:'corrected',text:'Price first for restocks',supersedesId:prior.id,facts:{priority:'price' as const}};const s=new MemoryService(repo,provider({recall:async()=>[prior]}));await s.queueMemory(ctx,prior);await s.queueMemory(ctx,correction);const result=await s.recallForBrief(ctx,{...data.briefs[0],purpose:'restock'},[]);expect(result.memories).toHaveLength(0);expect(result.status).toBe('partial');expect(result.missingActiveIds).toContain('corrected');});
 it('rejects cross-purpose corrections and conflicting retry payloads',async()=>{const prior=createSampleWorkspace('2026-11-08','operator').memories[0];const s=new MemoryService(repo,provider());await s.queueMemory(ctx,prior);await expect(s.queueMemory(ctx,{...prior,text:'changed'})).rejects.toMatchObject({code:'conflict'});await expect(s.queueMemory(ctx,{...prior,id:'bad',purpose:'restock',supersedesId:prior.id})).rejects.toMatchObject({code:'invalid_input'});});
 it('reports unavailable recall without silently loading local content',async()=>{const data=createSampleWorkspace('2026-11-08','operator');const s=new MemoryService(repo,provider({recall:async()=>{throw Error('offline');}}));await s.queueMemory(ctx,data.memories[0]);expect(await s.recallForBrief(ctx,data.briefs[0],['fixture-a'])).toMatchObject({status:'unavailable',memories:[]});});
});
