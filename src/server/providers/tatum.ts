import {z} from 'zod';
import {requestJson,ProviderError} from './http';
import type {PaymentProvider,TransactionEvidence} from './contracts';
export const DigestSchema=z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{43,44}$/);
// Sui retired JSON-RPC in 2026; Tatum serves Sui Mainnet reads through GraphQL with the same API key.
// The server caps both lists at 50 items per page (balance changes default to 20), so always ask for 50.
const endpoint='https://sui-mainnet.gateway.tatum.io/graphql';
const query='query Payment($digest:String!){transaction(digest:$digest){digest sender{address} gasInput{gasSponsor{address}} kind{__typename ...on ProgrammableTransaction{commands(first:50){pageInfo{hasNextPage} nodes{__typename}}}} effects{status checkpoint{sequenceNumber} gasEffects{gasSummary{computationCost storageCost storageRebate}} balanceChanges(first:50){pageInfo{hasNextPage} nodes{owner{address} coinType{repr} amount}}}}}';
const integer=z.union([z.string(),z.number()]).transform(String);
const address=z.object({address:z.string()}).nullable();
const page=z.object({hasNextPage:z.boolean()});
const transactionSchema=z.object({
  digest:z.string(),sender:address,gasInput:z.object({gasSponsor:address}).nullable(),
  kind:z.object({__typename:z.string(),commands:z.object({pageInfo:page,nodes:z.array(z.object({__typename:z.string()}))}).optional()}).nullable(),
  effects:z.object({status:z.enum(['SUCCESS','FAILURE']).nullable(),checkpoint:z.object({sequenceNumber:integer}).nullable(),gasEffects:z.object({gasSummary:z.object({computationCost:integer,storageCost:integer,storageRebate:integer}).nullable()}).nullable(),balanceChanges:z.object({pageInfo:page,nodes:z.array(z.object({owner:address,coinType:z.object({repr:z.string()}),amount:integer}))}).nullable()}).nullable(),
});
const responseSchema=z.object({data:z.object({transaction:transactionSchema.nullable()}),errors:z.array(z.unknown()).optional()});
export function createTatum(key:string,fetcher:typeof fetch=fetch):PaymentProvider{return {lookup:async digest=>{
  if(!key)throw new ProviderError('not_configured');DigestSchema.parse(digest);
  const response=await requestJson(endpoint,{method:'POST',headers:{'x-api-key':key,'Content-Type':'application/json'},body:JSON.stringify({query,variables:{digest}})},20000,fetcher);
  const parsed=responseSchema.safeParse(response);
  // Partial GraphQL results are never evaluated: any reported error rejects the whole lookup.
  if(!parsed.success||parsed.data.errors?.length)throw new ProviderError('invalid_response');
  const tx=parsed.data.data.transaction;if(!tx)throw new ProviderError('not_found');
  if(tx.digest!==digest)throw new ProviderError('invalid_response');
  return toEvidence(tx);
}};}
/** Maps the GraphQL transaction into the evidence shape that matchTransaction already checks conservatively. */
function toEvidence(tx:z.infer<typeof transactionSchema>):TransactionEvidence{
  const commands=tx.kind?.commands,balances=tx.effects?.balanceChanges;
  // A truncated list could hide commands or balance changes, so the marker makes the matcher refuse it as too complex.
  const truncated=!!commands?.pageInfo.hasNextPage||!!balances?.pageInfo.hasNextPage;
  return {
    digest:tx.digest,
    checkpoint:tx.effects?.checkpoint?.sequenceNumber,
    effects:{status:{status:tx.effects?.status==='SUCCESS'?'success':'failure'},gasUsed:tx.effects?.gasEffects?.gasSummary??undefined},
    // Missing participants stay empty so the matcher reports the evidence as incomplete rather than matching it.
    transaction:{data:{sender:tx.sender?.address??'',gasData:{owner:tx.gasInput?.gasSponsor?.address??''},transaction:{kind:tx.kind?.__typename??'',transactions:[...(commands?.nodes??[]).map(c=>({[c.__typename.replace(/Command$/,'')]:{}})),...(truncated?[{Truncated:{}}]:[])]}}},
    balanceChanges:(balances?.nodes??[]).map(b=>({owner:{AddressOwner:b.owner?.address},coinType:b.coinType.repr,amount:b.amount})),
  };
}
