import { createClient, type Client, type InValue, type Transaction } from '@libsql/client';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Brief, Context, WorkspaceSnapshot } from '@/domain/types';
import { BriefSchema } from '@/domain/schemas';
export type EntityKind='briefs'|'suppliers'|'evidence'|'quotes'|'memories'|'orderEvents'|'invoices'|'paymentChecks';
type SqlExecutor=Pick<Client,'execute'>|Pick<Transaction,'execute'>;
export class Repository {
  constructor(readonly db:Client){}
  close(){this.db.close();}
  async put<T extends {id:string}>(ctx:Context,kind:EntityKind,value:T,tx:SqlExecutor=this.db):Promise<T>{
    await tx.execute({sql:'INSERT INTO documents(store_id,kind,id,body) VALUES(?,?,?,?) ON CONFLICT(store_id,kind,id) DO UPDATE SET body=excluded.body',args:[ctx.storeId,kind,value.id,JSON.stringify(value)]});return value;
  }
  async get<T>(ctx:Context,kind:EntityKind,id:string,tx:SqlExecutor=this.db):Promise<T|null>{const r=await tx.execute({sql:'SELECT body FROM documents WHERE store_id=? AND kind=? AND id=?',args:[ctx.storeId,kind,id]});return r.rows.length?JSON.parse(String(r.rows[0].body)) as T:null;}
  async list<T>(ctx:Context,kind:EntityKind):Promise<T[]>{const r=await this.db.execute({sql:'SELECT body FROM documents WHERE store_id=? AND kind=? ORDER BY id',args:[ctx.storeId,kind]});return r.rows.map(row=>JSON.parse(String(row.body)) as T);}
  async saveBrief(ctx:Context,brief:Brief){return this.put(ctx,'briefs',BriefSchema.parse(brief));}
  async getBrief(ctx:Context,id:string){return this.get<Brief>(ctx,'briefs',id);}
  async getWorkspace(ctx:Context):Promise<WorkspaceSnapshot>{
    const kinds:EntityKind[]=['briefs','suppliers','evidence','quotes','memories','orderEvents','invoices','paymentChecks'];
    const values=await Promise.all(kinds.map(kind=>this.list(ctx,kind)));
    const jobs=await this.db.execute({sql:'SELECT * FROM memory_outbox WHERE store_id=?',args:[ctx.storeId]});
    return {...Object.fromEntries(kinds.map((kind,i)=>[kind,values[i]])),memoryWrites:jobs.rows.map(row=>({recordId:String(row.record_id),operationKey:String(row.operation_key),jobId:row.job_id?String(row.job_id):null,state:String(row.state),receipt:row.receipt?JSON.parse(String(row.receipt)):null,errorCode:row.error_code?String(row.error_code):null}))} as WorkspaceSnapshot;
  }
  async execute(sql:string,args:InValue[]=[]){return this.db.execute({sql,args});}
}
export async function createRepository(config:{url:string;authToken?:string}):Promise<Repository>{
  if(config.url.startsWith('file:')&&config.url!=='file::memory:')await mkdir(path.dirname(config.url.slice(5)),{recursive:true});
  const db=createClient(config);
  const schema=await readFile(path.join(process.cwd(),'src/server/db/migrations/001_initial.sql'),'utf8');
  await db.executeMultiple(schema);
  return new Repository(db);
}
