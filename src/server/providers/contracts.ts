import type {MemoryRecord,MemoryWrite,DraftInput,CitedDraft} from '@/domain/types';
export interface SearchHit{title:string;url:string;content:string}
export interface SearchProvider{search(query:string):Promise<SearchHit[]>}
export type MemoryJobStatus={state:MemoryWrite['state'];receipt?:Record<string,unknown>;errorCode?:string};
export interface MemoryProvider{submit(record:MemoryRecord,key:string):Promise<{jobId:string}>;status(jobId:string):Promise<MemoryJobStatus>;recall(query:string,limit:number):Promise<MemoryRecord[]>;health():Promise<void>}
export interface TransactionEvidence{digest:string;checkpoint?:string;effects?:{status?:{status:string};gasUsed?:{computationCost:string;storageCost:string;storageRebate:string}};transaction?:{data?:{sender:string;gasData?:{owner:string};transaction?:{kind:string;transactions?:Record<string,unknown>[]}}};balanceChanges?:{owner:unknown;coinType:string;amount:string}[]}
export interface PaymentProvider{lookup(digest:string):Promise<TransactionEvidence>}
export interface ExtractedQuote{supplierName:string;specification:string|null;quantity:number|null;currency:string|null;unitPriceCents:number|null;shippingCents:number|null;taxCents:number|null;minimumOrder:number|null;quotedAt:string|null;productionDays:number|null;transitDays:number|null;deliveryDaysKind:'calendar'|'business'|'unknown';expiry:string|null;paymentTerms:string}
export interface LlmProvider{extractQuote(text:string):Promise<ExtractedQuote>;draft(input:DraftInput):Promise<CitedDraft>}
export interface Providers{search:SearchProvider;memory:MemoryProvider;payment:PaymentProvider;llm:LlmProvider}
