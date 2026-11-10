import {describe,it,expect} from 'vitest';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createRepository,type Repository} from '../src/server/db/repository';
import {createSampleWorkspace} from '../src/domain/fixtures';
import {MemoryService} from '../src/features/memory/service';
import {buildLiveProof} from '../src/features/proof/live';
import {loadConfig} from '../src/server/config';
import type {MemoryRecord} from '../src/domain/types';
import type {Providers,TransactionEvidence} from '../src/server/providers/contracts';

const ctx={storeId:'operator',now:'2026-11-08T12:00:00Z'};
// Simple transfer: 1000 to 0x2, sender pays 25 net gas.
const tx:TransactionEvidence={digest:'D'.repeat(44),checkpoint:'123',effects:{status:{status:'success'},gasUsed:{computationCost:'20',storageCost:'10',storageRebate:'5'}},transaction:{data:{sender:'0x1',gasData:{owner:'0x1'},transaction:{kind:'ProgrammableTransaction',transactions:[{SplitCoins:{}},{TransferObjects:{}}]}}},balanceChanges:[{owner:{AddressOwner:'0x1'},coinType:'0x2::sui::SUI',amount:'-1025'},{owner:{AddressOwner:'0x2'},coinType:'0x2::sui::SUI',amount:'1000'}]};
const invoice={id:'demo-invoice',supplierId:'fixture-b',expectedSender:'0x1',expectedRecipient:'0x2',assetType:'0x2::sui::SUI',amountAtomic:'1000'};
const config=(edits:Partial<ReturnType<typeof loadConfig>>={})=>({...loadConfig({}),sampleDigest:tx.digest,sampleInvoiceJson:JSON.stringify(invoice),...edits});
const counts=async(repo:Repository)=>Object.fromEntries(await Promise.all(['documents','memory_outbox','payment_claims'].map(async t=>[t,Number((await repo.execute(`SELECT COUNT(*) n FROM ${t}`)).rows[0].n)])));

/** The fictional demo scenario saved to a fake Walrus, plus one real supplier that must never be shown. */
async function seeded(){
  const dir=await mkdtemp(path.join(tmpdir(),'recall-live-'));const repo=await createRepository({url:`file:${path.join(dir,'live.db').replaceAll('\\','/')}`});
  const w=createSampleWorkspace('2026-11-08','operator');const remote=new Map<string,MemoryRecord>();let lookups=0;
  const providers={memory:{health:async()=>{},submit:async(r:MemoryRecord)=>{remote.set(r.id,r);return {jobId:r.id};},status:async(id:string)=>({state:'saved' as const,receipt:{blobId:'blob-'+id}}),recall:async()=>[...remote.values()]},payment:{lookup:async()=>{lookups++;return tx;}}} as unknown as Providers;
  await repo.saveBrief(ctx,w.briefs[0]);for(const s of w.suppliers)await repo.put(ctx,'suppliers',s);for(const q of w.quotes)await repo.put(ctx,'quotes',q);for(const e of w.evidence)await repo.put(ctx,'evidence',e);
  const memory=new MemoryService(repo,providers.memory);const prior=w.memories.find(m=>m.id==='mem-restock')!;
  for(const record of [...w.memories,{...prior,id:'restock-correction',supersedesId:prior.id,occurredAt:'2026-11-08T13:00:00Z',facts:{priority:'price' as const}}]){await memory.queueMemory(ctx,record);await memory.reconcileMemory(ctx,record.id);}
  await repo.put(ctx,'suppliers',{id:'web-real',name:'Real Packaging Inc.',domain:'real.example',identityConfirmed:true,fictional:false,location:'US'});
  await repo.put(ctx,'quotes',{...w.quotes[0],id:'real-quote',supplierId:'web-real',unitPriceCents:1,shippingCents:0});
  const realNote={...w.memories[2],id:'real-note',supplierId:'web-real',text:'Private note about a real supplier'};await memory.queueMemory(ctx,realNote);remote.set(realNote.id,realNote);
  return {repo,providers,lookups:()=>lookups};
}

describe('public live proof',()=>{
  it('shows recalled memory changing the decision without exposing real suppliers or writing anything',async()=>{
    const {repo,providers,lookups}=await seeded();
    try{
      const before=await counts(repo);
      const proof=await buildLiveProof(repo,providers,config(),ctx.now);
      expect(proof.decisions.map(d=>d.rankedSupplierIds[0])).toEqual(['fixture-a','fixture-b','fixture-a']);
      expect(proof.decisions.slice(1).map(d=>d.memoryStatus)).toEqual(['complete','complete']);
      expect(proof.decisions[2].recalledMemoryIds).toContain('restock-correction');
      expect(proof.decisions[2].recalledMemoryIds).not.toContain('mem-restock');
      expect(proof.memories).toHaveLength(13);
      expect(proof.memories.every(m=>m.state==='saved'&&m.blobId===`blob-${m.id}`)).toBe(true);
      expect(proof.memories.find(m=>m.id==='mem-restock')?.supersededBy).toBe('restock-correction');
      const shown=JSON.stringify(proof);
      expect(shown).not.toContain('web-real');expect(shown).not.toContain('Real Packaging');expect(shown).not.toContain('Private note');
      expect(proof.payment).toMatchObject({state:'checked',match:{verified:true},mismatch:{amountAtomic:'1001',verified:false}});
      expect(lookups()).toBe(1);
      expect(await counts(repo)).toEqual(before);
      expect(before.payment_claims).toBe(0);
    }finally{repo.close();}
  });
  it('reports a missing or malformed sample payment instead of failing the page',async()=>{
    const {repo,providers,lookups}=await seeded();
    try{
      expect((await buildLiveProof(repo,providers,config({sampleDigest:''}),ctx.now)).payment).toEqual({state:'not_configured'});
      const malformed=await buildLiveProof(repo,providers,config({sampleInvoiceJson:'{"id":"x"}'}),ctx.now);
      expect(malformed.payment.state).toBe('invalid_configuration');
      expect(malformed.decisions).toHaveLength(3);
      expect(lookups()).toBe(0);
    }finally{repo.close();}
  });
});
