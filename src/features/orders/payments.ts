import type {Invoice,Context,PaymentCheck} from '@/domain/types';
import type {PaymentProvider,TransactionEvidence} from '@/server/providers/contracts';
import type {Repository} from '@/server/db/repository';
import {InvoiceSchema} from '@/domain/schemas';
import {DigestSchema} from '@/server/providers/tatum';
import {ProviderError} from '@/server/providers/http';
const address=(value:string)=>{if(!/^0x[0-9a-fA-F]{1,64}$/.test(value))throw Error('address');return `0x${value.slice(2).toLowerCase().padStart(64,'0')}`;};
const asset=(value:string)=>{const [a,...rest]=value.split('::');return `${address(a)}::${rest.join('::')}`;};
export function matchTransaction(invoice:Invoice,tx:TransactionEvidence):string|null{
  try{
    if(tx.effects?.status?.status!=='success'||!tx.checkpoint||!/^\d+$/.test(tx.checkpoint))return 'Execution is not confirmed.';
    const sender=address(invoice.expectedSender),recipient=address(invoice.expectedRecipient);if(sender===recipient)return 'Sender and recipient must differ.';
    const data=tx.transaction?.data;if(!data||address(data.sender)!==sender)return 'Sender does not match the invoice.';
    const commands=data.transaction?.transactions;if(data.transaction?.kind!=='ProgrammableTransaction'||!commands?.length||commands.some(c=>Object.keys(c).length!==1||!('SplitCoins' in c||'TransferObjects' in c))||commands.filter(c=>'TransferObjects' in c).length!==1)return 'This transaction is too complex to match safely.';
    const coin=asset(invoice.assetType),sui=asset('0x2::sui::SUI'),amount=BigInt(invoice.amountAtomic);const gasOwner=address(data.gasData?.owner??'');if(gasOwner===recipient)return 'Recipient-paid gas is not supported.';
    const gas=tx.effects.gasUsed;if(!gas)return 'Gas evidence is missing.';const netGas=BigInt(gas.computationCost)+BigInt(gas.storageCost)-BigInt(gas.storageRebate);
    const balances=(tx.balanceChanges??[]).map(b=>({owner:address((b.owner as {AddressOwner:string}).AddressOwner),coin:asset(b.coinType),amount:BigInt(b.amount)}));
    if(!balances.length)return 'Transfer evidence is missing.';
    const relevant=balances.filter(b=>b.coin===coin);if(relevant.filter(b=>b.owner===recipient).length!==1||relevant.filter(b=>b.owner===sender).length!==1)return 'Transfer participants are ambiguous.';
    if(relevant.find(b=>b.owner===recipient)!.amount!==amount)return 'Recipient or received amount does not match the invoice.';
    if(relevant.find(b=>b.owner===sender)!.amount!==-amount-(coin===sui&&gasOwner===sender?netGas:0n))return 'Sender amount does not match after accounting for gas.';
    for(const b of balances){if(b.coin===coin&&(b.owner===sender||b.owner===recipient))continue;if(b.coin===sui&&b.owner===gasOwner&&b.amount===-netGas)continue;return 'Additional balance changes make this payment ambiguous.';}
    return null;
  }catch{return 'Transaction evidence is incomplete or malformed.';}
}
export async function verifyInvoicePayment(repo:Repository,provider:PaymentProvider,ctx:Context,id:string,digest:string):Promise<PaymentCheck>{
  const raw=await repo.get<Invoice>(ctx,'invoices',id);if(!raw)throw new ProviderError('not_found');const invoice=InvoiceSchema.parse(raw);
  let reason='';try{DigestSchema.parse(digest);const tx=await provider.lookup(digest);reason=tx.digest===digest?matchTransaction(invoice,tx)??'':'Transaction digest does not match.';}catch(e){reason=e instanceof ProviderError?`Payment lookup ${e.code.replaceAll('_',' ')}.`:'Invalid transaction or unavailable evidence.';}
  if(!reason){await repo.execute('INSERT OR IGNORE INTO payment_claims(network,digest,store_id,invoice_id) VALUES(?,?,?,?)',['sui-mainnet',digest,ctx.storeId,id]);const claim=await repo.execute('SELECT store_id,invoice_id FROM payment_claims WHERE network=? AND digest=?',['sui-mainnet',digest]);if(claim.rows[0]?.store_id!==ctx.storeId||claim.rows[0]?.invoice_id!==id)reason='This transaction is already matched to another invoice.';}
  const result:PaymentCheck={invoiceId:id,digest,checkedAt:ctx.now,status:reason?'unverified':'verified',reason:reason||'Execution, sender, recipient, asset, and amount match. This does not prove delivery.'};await repo.put(ctx,'paymentChecks',{...result,id:crypto.randomUUID()});return result;
}
