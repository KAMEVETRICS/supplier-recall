import {readFile} from 'node:fs/promises';
import {config,checks,check,report,liveRequested} from './shared';
import {createRepository} from '../src/server/db/repository';
import {createProviders} from '../src/server/providers';
import {MemoryService} from '../src/features/memory/service';
import {compareEvidence} from '../src/features/comparison/engine';
import {createSampleWorkspace} from '../src/domain/fixtures';
import {storeDate} from '../src/domain/date';
import {InvoiceSchema} from '../src/domain/schemas';
import {matchTransaction} from '../src/features/orders/payments';
import {safeSourceUrl} from '../src/features/research/identity';
const p=createProviders(config);const ctx={storeId:'operator',now:new Date().toISOString()};
await check('Durable Mainnet memories and fresh recall',liveRequested&&!!config.memwalKey&&!!config.memwalAccount,async()=>{
 const repo=await createRepository({url:config.databaseUrl,authToken:config.databaseToken});try{
  const w=await repo.getWorkspace(ctx);const receipts=new Set(w.memoryWrites.filter(j=>j.state==='saved'&&j.jobId&&j.receipt?.blobId).map(j=>j.recordId));if(receipts.size<10)throw Error();
  const sample=createSampleWorkspace(storeDate(ctx.now),ctx.storeId);const memory=new MemoryService(repo,p.memory);const ids=sample.suppliers.map(s=>s.id);
  const launchRecall=await memory.recallForBrief(ctx,sample.briefs[0],ids);const restockBrief={...sample.briefs[0],purpose:'restock' as const};const restockRecall=await memory.recallForBrief(ctx,restockBrief,ids);
  const recalled=new Set([...launchRecall.memories,...restockRecall.memories].filter(m=>receipts.has(m.id)).map(m=>m.id));if(recalled.size<10)throw Error();
  const baseline=compareEvidence(sample.briefs[0],sample.quotes,sample.evidence,{memories:[],status:'complete',missingActiveIds:[]},ctx.now);
  const launch=compareEvidence(sample.briefs[0],sample.quotes,sample.evidence,launchRecall,ctx.now);const restock=compareEvidence(restockBrief,sample.quotes,sample.evidence,restockRecall,ctx.now);
  if(baseline.rankedSupplierIds[0]!=='fixture-a'||launch.rankedSupplierIds[0]!=='fixture-b'||restock.rankedSupplierIds[0]!=='fixture-a'||launch.memoryStatus!=='complete'||restock.memoryStatus!=='complete'||!restock.recalledMemoryIds.includes('mem-restock-price'))throw Error();
  if(!launch.reasons.some(r=>r.memoryIds.includes('mem-b-delivery')))throw Error();
  return `${receipts.size} durable records; ${recalled.size} recalled in this fresh process. Launch and corrected restock recommendations cite recalled IDs.`;
 }finally{repo.close();}
});
await check('Live supplier discovery',liveRequested&&!!config.tavilyKey,async()=>{const hits=await p.search.search('kraft packaging supplier United States');const sources=hits.filter(h=>safeSourceUrl(h.url));if(!sources.length)throw Error();return `${sources.length} live source URLs returned.`;});
await check('Tatum matching payment and deliberate mismatch',liveRequested&&!!config.tatumKey&&!!config.sampleDigest&&!!process.env.SUI_SAMPLE_INVOICE_PATH,async()=>{
 const invoice=InvoiceSchema.parse(JSON.parse(await readFile(process.env.SUI_SAMPLE_INVOICE_PATH!,'utf8')));const tx=await p.payment.lookup(config.sampleDigest);
 if(matchTransaction(invoice,tx)!==null||matchTransaction({...invoice,amountAtomic:(BigInt(invoice.amountAtomic)+1n).toString()},tx)===null)throw Error();return 'Existing transaction matches independently supplied invoice; changed amount is rejected. No transaction was sent.';
});
// Publication needs actual URLs and an authorized deployed smoke test, not mere URL configuration.
checks.push({name:'Public demo, repository, blog, and submission',status:'blocked',detail:'Publication and deployed persistence/isolation checks must be completed and recorded separately.'});
await report('submission-readiness');
