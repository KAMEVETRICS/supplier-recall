import {z} from 'zod';
import {getRuntime} from '@/server/runtime';
import {authorizeRequest} from '@/server/auth/guard';
import {json,readJson,respondError} from '@/server/http';
import {ProviderError} from '@/server/providers/http';
import {BriefSchema,QuoteSchema,SupplierSchema,MemorySchema,InvoiceSchema,EventSchema} from '@/domain/schemas';
import {ResearchService} from '@/features/research/application';
import {MemoryService} from '@/features/memory/service';
import {ComparisonService} from '@/features/comparison/service';
import {recordOrderEvent} from '@/features/orders/service';
import {verifyInvoicePayment} from '@/features/orders/payments';
import type {Supplier,MemoryRecord} from '@/domain/types';
import {storeDate} from '@/domain/date';
import {createSampleWorkspace} from '@/domain/fixtures';
import {safeSourceUrl} from '@/features/research/identity';
export const runtime='nodejs';
const id=z.string().min(1).max(120).regex(/^[\w-]+$/);
export async function POST(request:Request,{params}:{params:Promise<{action:string[]}>}){
 try{
  const r=await getRuntime();const ctx=await authorizeRequest(request,r.auth,r.config.origin);const body=await readJson(request);const route=(await params).action.join('/');const research=new ResearchService(r.repo,r.providers);const memory=new MemoryService(r.repo,r.providers.memory);const comparison=new ComparisonService(r.repo,r.providers);
  if(route==='briefs')return json(await research.saveBrief(ctx,BriefSchema.parse(body)));
  if(route==='suppliers'){
    const supplier=SupplierSchema.parse(body);const existing=await r.repo.get<Supplier>(ctx,'suppliers',supplier.id);
    if(existing&&existing.fictional!==supplier.fictional)throw new ProviderError('invalid_input');
    if(supplier.domain&&!safeSourceUrl(`https://${supplier.domain}`))throw new ProviderError('invalid_input');
    return json(await r.repo.put(ctx,'suppliers',supplier));
  }
  if(route==='research'){
    const input=z.object({briefId:id}).parse(body);await r.auth.reserve(ctx.storeId,'research',10);const result=await research.discover(ctx,input.briefId);
    for(const e of result.evidence)await memory.queueMemory(ctx,{id:`research-${e.id}`,storeId:ctx.storeId,supplierId:e.supplierId,kind:'research',purpose:null,text:`Public supplier claim, not verified: ${e.excerpt.slice(0,3500)}`,occurredAt:ctx.now,evidenceIds:[e.id],supersedesId:null});
    return json(result);
  }
  if(route==='quotes/extract'){const input=z.object({briefId:id,text:z.string().max(100000),format:z.enum(['text','csv'])}).parse(body);await r.auth.reserve(ctx.storeId,'llm',20);return json(await research.extract(ctx,input.briefId,input.text,input.format));}
  if(route==='quotes/confirm'){const input=z.object({quote:QuoteSchema,supplierId:id,sourceText:z.string().min(1).max(8000)}).parse(body);return json(await research.confirm(ctx,input));}
  if(route==='compare'){const input=z.object({briefId:id}).parse(body);await r.auth.reserve(ctx.storeId,'compare',30);return json(await comparison.compareBrief(ctx,input.briefId));}
  if(route==='drafts'){
    const input=z.object({briefId:id,supplierId:id}).parse(body);await r.auth.reserve(ctx.storeId,'llm',20);const result=await comparison.compareBrief(ctx,input.briefId);const supplier=await r.repo.get<Supplier>(ctx,'suppliers',input.supplierId);if(!supplier)throw new ProviderError('not_found');return json(await comparison.draftFollowUp(ctx,{comparison:result,supplierName:supplier.name,commitments:[]}));
  }
  if(route==='memories'){const record=MemorySchema.parse(body);if(record.storeId!==ctx.storeId)throw new ProviderError('forbidden');if(record.supplierId&&!await r.repo.get(ctx,'suppliers',record.supplierId))throw new ProviderError('not_found');return json(await memory.queueMemory(ctx,record));}
  if(route.startsWith('memories/')&&route.endsWith('/status')){const recordId=id.parse(route.split('/')[1]);const w=await r.repo.getWorkspace(ctx);if(w.memoryWrites.some(m=>m.recordId===recordId&&!m.jobId))await r.auth.reserve(ctx.storeId,'memory-submit',50);else await r.auth.reserve(ctx.storeId,'memory-status',300);return json(await memory.reconcileMemory(ctx,recordId));}
  if(route==='orders/events')return json(await recordOrderEvent(r.repo,r.providers.memory,ctx,EventSchema.parse(body)));
  if(route==='invoices')return json(await r.repo.put(ctx,'invoices',InvoiceSchema.parse(body)));
  if(route==='payments/verify'){const input=z.object({invoiceId:id,digest:z.string().max(100)}).parse(body);await r.auth.reserve(ctx.storeId,'payment-read',30);return json(await verifyInvoicePayment(r.repo,r.providers.payment,ctx,input.invoiceId,input.digest));}
  if(route==='demo/seed'){
    const data=createSampleWorkspace(storeDate(ctx.now),ctx.storeId);
    const existing=await r.repo.getWorkspace(ctx);if(existing.briefs.length)throw new ProviderError('conflict');
    await r.repo.saveBrief(ctx,data.briefs[0]);for(const s of data.suppliers)await r.repo.put(ctx,'suppliers',s);for(const e of data.evidence)await r.repo.put(ctx,'evidence',e);for(const q of data.quotes)await r.repo.put(ctx,'quotes',q);for(const m of data.memories)await memory.queueMemory(ctx,m as MemoryRecord);
    return json(await r.repo.getWorkspace(ctx));
  }
  throw new ProviderError('not_found');
 }catch(e){return respondError(e);}
}
