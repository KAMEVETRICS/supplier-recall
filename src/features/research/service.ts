import type {Brief,Supplier,Evidence} from '@/domain/types';
import type {SearchProvider} from '@/server/providers/contracts';
import {safeSourceUrl} from './identity';
import {ProviderError} from '@/server/providers/http';
import {createHash} from 'node:crypto';
export async function discoverCandidates(brief:Brief,search:SearchProvider,now:string):Promise<{suppliers:Supplier[];evidence:Evidence[];warnings:string[]}>{
  const queries=[`${brief.specification} packaging supplier United States`,`${brief.specification} wholesale ${brief.quantity} ${brief.destination}`,`${brief.specification} supplier production shipping lead time US`];
  const responses=await Promise.allSettled(queries.map(q=>search.search(q)));const suppliers:Supplier[]=[];const evidence:Evidence[]=[];const warnings:string[]=[];const domains=new Map<string,string>();
  if(responses.every(r=>r.status==='rejected'))throw responses[0].status==='rejected'?responses[0].reason:new ProviderError('unavailable');
  for(const result of responses){if(result.status==='rejected'){warnings.push('One search could not complete. This shortlist may be incomplete.');continue;}for(const hit of result.value){const url=safeSourceUrl(hit.url);if(!url||!hit.content.trim())continue;const domain=new URL(url).hostname.replace(/^www\./,'');if(domains.has(domain))continue;if(suppliers.length>=5)continue;const id=`web-${createHash('sha256').update(domain).digest('hex').slice(0,32)}`;domains.set(domain,id);suppliers.push({id,name:hit.title.slice(0,150),domain,identityConfirmed:false,fictional:false,location:'Location needs confirmation'});evidence.push({id:`source-${crypto.randomUUID()}`,supplierId:id,kind:'web_claim',source:url,retrievedAt:now,excerpt:hit.content.slice(0,8000),fictional:false});}}
  return {suppliers,evidence,warnings};
}
