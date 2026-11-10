import type {Context,DraftInput,CitedDraft} from '@/domain/types';
import type {Repository} from '@/server/db/repository';
import type {Providers} from '@/server/providers/contracts';
import {MemoryService} from '@/features/memory/service';
import {compareEvidence} from './engine';
import {templateDraft} from './drafts';
import {ProviderError} from '@/server/providers/http';
export class ComparisonService{
 constructor(private repo:Repository,private providers:Providers){}
 async compareBrief(ctx:Context,id:string){const w=await this.repo.getWorkspace(ctx);const brief=w.briefs.find(b=>b.id===id);if(!brief)throw new ProviderError('not_found');const quotes=w.quotes.filter(q=>q.briefId===id&&w.suppliers.some(s=>s.id===q.supplierId&&s.identityConfirmed));const recall=await new MemoryService(this.repo,this.providers.memory).recallForBrief(ctx,brief,[...new Set(quotes.map(q=>q.supplierId))]);return compareEvidence(brief,quotes,w.evidence,recall,ctx.now);}
 async draftFollowUp(_ctx:Context,input:DraftInput):Promise<CitedDraft>{return templateDraft(input);}
}
