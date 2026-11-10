import type {Context,MemoryRecord,MemoryWrite,Brief,RecallResult} from '@/domain/types';
import type {Repository} from '@/server/db/repository';
import type {MemoryProvider} from '@/server/providers/contracts';
import {MemorySchema} from '@/domain/schemas';
import {ProviderError} from '@/server/providers/http';
import type {Transaction} from '@libsql/client';
export class MemoryService{
 constructor(private repo:Repository,private provider:MemoryProvider){}
 async queueMemory(ctx:Context,input:MemoryRecord,transaction?:Transaction):Promise<MemoryWrite>{
   const record=MemorySchema.parse(input);if(record.storeId!==ctx.storeId||record.id===record.supersedesId)throw new ProviderError('invalid_input');
   const tx=transaction??await this.repo.db.transaction('write');
   try{
     const existing=await this.repo.get<MemoryRecord>(ctx,'memories',record.id,tx);
     if(existing&&JSON.stringify(existing)!==JSON.stringify(record))throw new ProviderError('conflict');
     if(record.supersedesId){const prior=await this.repo.get<MemoryRecord>(ctx,'memories',record.supersedesId,tx);if(!prior||prior.purpose!==record.purpose||prior.kind!==record.kind||prior.supplierId!==record.supplierId)throw new ProviderError('invalid_input');}
     if(!existing)await this.repo.put(ctx,'memories',record,tx);
     await tx.execute({sql:'INSERT OR IGNORE INTO memory_outbox(store_id,record_id,operation_key) VALUES(?,?,?)',args:[ctx.storeId,record.id,`${ctx.storeId}:${record.id}`]});
     const r=await tx.execute({sql:'SELECT * FROM memory_outbox WHERE store_id=? AND record_id=?',args:[ctx.storeId,record.id]});
     if(!transaction)await tx.commit();return rowToWrite(r.rows[0]);
   }catch(e){if(!transaction)await tx.rollback();throw e;}finally{if(!transaction)tx.close();}
 }
 async reconcileMemory(ctx:Context,id:string):Promise<MemoryWrite>{
   const r=await this.repo.execute('SELECT * FROM memory_outbox WHERE store_id=? AND record_id=?',[ctx.storeId,id]);if(!r.rows.length)throw new ProviderError('not_found');
   const write=rowToWrite(r.rows[0]);if(write.state==='saved'||write.state==='failed')return write;
   const record=await this.repo.get<MemoryRecord>(ctx,'memories',id);if(!record)throw new ProviderError('not_found');
   try{
     if(!write.jobId){const result=await this.provider.submit(record,write.operationKey);write.jobId=result.jobId;write.state='accepted';await this.repo.execute("UPDATE memory_outbox SET job_id=?,state='accepted',error_code=NULL WHERE store_id=? AND record_id=?",[write.jobId,ctx.storeId,id]);}
     const status=await this.provider.status(write.jobId);if(status.state==='saved'&&!status.receipt)throw new ProviderError('invalid_response');
     write.state=status.state;write.receipt=status.receipt??null;write.errorCode=status.errorCode??null;
   }catch(e){write.errorCode=e instanceof ProviderError?e.code:'unavailable';}
   await this.repo.execute('UPDATE memory_outbox SET state=?,receipt=?,error_code=? WHERE store_id=? AND record_id=?',[write.state,write.receipt?JSON.stringify(write.receipt):null,write.errorCode,ctx.storeId,id]);return write;
 }
 async recallForBrief(ctx:Context,brief:Brief,ids:string[]):Promise<RecallResult>{
   const ledger=await this.repo.list<MemoryRecord>(ctx,'memories');const superseded=new Set(ledger.map(m=>m.supersedesId).filter(Boolean));
   const expected=ledger.filter(m=>m.kind==='preference'&&m.purpose===brief.purpose&&!superseded.has(m.id));
   const queries=[`${ctx.storeId} preferences ${brief.purpose} ${brief.specification}`,...ids.slice(0,5).map(id=>`${ctx.storeId} supplier ${id} delivery quality commitments outcomes`)];
   const reads=await Promise.allSettled(queries.map(q=>this.provider.recall(q,50)));
   if(reads.every(r=>r.status==='rejected'))return {memories:[],status:'unavailable',missingActiveIds:expected.map(m=>m.id)};
   const memories=new Map<string,MemoryRecord>();let partial=false;
   for(const read of reads){if(read.status==='rejected'){partial=true;continue;}if(read.value.length>=50)partial=true;for(const raw of read.value){const parsed=MemorySchema.safeParse(raw);if(!parsed.success)continue;const m=parsed.data;if(m.storeId!==ctx.storeId||superseded.has(m.id)||(m.supplierId&&!ids.includes(m.supplierId))||(m.purpose&&m.purpose!==brief.purpose))continue;memories.set(m.id,m);}}
   const missingActiveIds=expected.filter(m=>!memories.has(m.id)).map(m=>m.id);
   return {memories:[...memories.values()],status:partial||missingActiveIds.length?'partial':'complete',missingActiveIds};
 }
}
function rowToWrite(row:Record<string,unknown>):MemoryWrite{return {recordId:String(row.record_id),operationKey:String(row.operation_key),jobId:row.job_id?String(row.job_id):null,state:row.state as MemoryWrite['state'],receipt:row.receipt?JSON.parse(String(row.receipt)):null,errorCode:row.error_code?String(row.error_code):null};}
