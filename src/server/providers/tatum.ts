import {z} from 'zod';
import {requestJson,ProviderError} from './http';
import type {PaymentProvider,TransactionEvidence} from './contracts';
export const DigestSchema=z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{43,44}$/);
const responseSchema=z.object({result:z.object({digest:z.string()}).passthrough()});
export function createTatum(key:string,fetcher:typeof fetch=fetch):PaymentProvider{return {lookup:async digest=>{
  if(!key)throw new ProviderError('not_configured');DigestSchema.parse(digest);
  const response=await requestJson('https://sui-mainnet.gateway.tatum.io/',{method:'POST',headers:{'x-api-key':key,'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'sui_getTransactionBlock',params:[digest,{showInput:true,showEffects:true,showBalanceChanges:true}]})},20000,fetcher);
  const parsed=responseSchema.safeParse(response);if(!parsed.success||parsed.data.result.digest!==digest)throw new ProviderError('invalid_response');return parsed.data.result as TransactionEvidence;
}};}
