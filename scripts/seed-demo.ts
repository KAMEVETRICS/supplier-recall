import {config,checks,report,liveRequested} from './shared';
import {createRepository} from '../src/server/db/repository';
import {createProviders} from '../src/server/providers';
import {MemoryService} from '../src/features/memory/service';
import {createSampleWorkspace} from '../src/domain/fixtures';
import {storeDate} from '../src/domain/date';
import type {MemoryRecord} from '../src/domain/types';
// Explicit --live targets only a dedicated demo namespace and fictional data.
if(!liveRequested||config.mode!=='live'||!config.memwalKey||!config.memwalAccount||!config.namespace.includes('demo')){
 checks.push({name:'Demo seed',status:'blocked',detail:'Set live credentials and a dedicated namespace containing demo; invoke with --live.'});
}else{
 const repo=await createRepository({url:config.databaseUrl,authToken:config.databaseToken});
 try{
  const ctx={storeId:'operator',now:new Date().toISOString()};const service=new MemoryService(repo,createProviders(config).memory);
  const existing=await repo.getWorkspace(ctx);const initial=createSampleWorkspace(storeDate(ctx.now),ctx.storeId);
  if(existing.suppliers.some(s=>!s.fictional))throw Error('Use a dedicated demo database.');
  if(!existing.briefs.length){await repo.saveBrief(ctx,initial.briefs[0]);for(const s of initial.suppliers)await repo.put(ctx,'suppliers',s);for(const e of initial.evidence)await repo.put(ctx,'evidence',e);for(const q of initial.quotes)await repo.put(ctx,'quotes',q);}
  for(const m of initial.memories){const saved=await repo.get<MemoryRecord>(ctx,'memories',m.id);await service.queueMemory(ctx,saved??m);}
  const prior=await repo.get<MemoryRecord>(ctx,'memories','mem-restock');
  const correction:MemoryRecord={...prior!,id:'mem-restock-price',text:'For routine restocks, prioritize price among suppliers meeting the requirements.',occurredAt:ctx.now,supersedesId:'mem-restock',facts:{priority:'price'}};
  await service.queueMemory(ctx,await repo.get<MemoryRecord>(ctx,'memories',correction.id)??correction);
  // One bounded reconciliation pass per invocation; reruns reuse stored IDs/jobs.
  const w=await repo.getWorkspace(ctx);for(const job of w.memoryWrites)await service.reconcileMemory(ctx,job.recordId);
  const next=await repo.getWorkspace(ctx);const saved=next.memoryWrites.filter(j=>j.state==='saved'&&j.receipt?.blobId).length;
  checks.push({name:'Demo seed',status:saved>=13?'pass':'blocked',detail:`${saved}/13 records have durable receipts. Rerun to check pending jobs; accepted is not saved.`});
 }catch{checks.push({name:'Demo seed',status:'fail',detail:'Seeding did not finish. Existing operation IDs are retained for safe retry.'});}finally{repo.close();}
}
await report('seed');
