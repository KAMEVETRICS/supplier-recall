import type { Context, Supplier, Quote, Evidence, Brief } from '@/domain/types';
import { QuoteSchema, BriefSchema } from '@/domain/schemas';
import type { Repository } from '@/server/db/repository';
import type { Providers, ExtractedQuote } from '@/server/providers/contracts';
import { ProviderError } from '@/server/providers/http';
import { discoverCandidates } from './service';
import { parseCsvQuotes } from './quotes';
export class ResearchService {
  constructor(
    private repo: Repository,
    private providers: Providers,
  ) {}
  async discover(ctx: Context, briefId: string) {
    const brief = await this.repo.getBrief(ctx, briefId);
    if (!brief) throw new ProviderError('not_found');
    const result = await discoverCandidates(brief, this.providers.search, ctx.now);
    for (const supplier of result.suppliers) {
      const previous = await this.repo.get<Supplier>(ctx, 'suppliers', supplier.id);
      if (previous && previous.domain !== supplier.domain) throw new ProviderError('conflict');
      await this.repo.put(ctx, 'suppliers', previous ?? supplier);
    }
    for (const evidence of result.evidence) await this.repo.put(ctx, 'evidence', evidence);
    return result;
  }
  async extract(ctx: Context, briefId: string, text: string, format: 'text' | 'csv') {
    if (Buffer.byteLength(text) > 100000 || !text.trim()) throw new ProviderError('invalid_input');
    const brief = await this.repo.getBrief(ctx, briefId);
    if (!brief) throw new ProviderError('not_found');
    const extracts: ExtractedQuote[] =
      format === 'csv' ? parseCsvQuotes(text) : [await this.providers.llm.extractQuote(text)];
    return extracts.map((extract) => ({ extract, briefId, sourceText: text.slice(0, 8000) }));
  }
  async confirm(ctx: Context, input: { quote: Quote; supplierId: string; sourceText: string }) {
    const quote = QuoteSchema.parse({
      ...input.quote,
      supplierId: input.supplierId,
      confirmedAt: ctx.now,
    });
    const supplier = await this.repo.get<Supplier>(ctx, 'suppliers', input.supplierId);
    if (!supplier || !supplier.identityConfirmed) throw new ProviderError('identity_required');
    if (!(await this.repo.getBrief(ctx, quote.briefId))) throw new ProviderError('not_found');
    const evidence: Evidence = {
      id: `quote-source-${quote.id}`,
      supplierId: supplier.id,
      kind: 'quote',
      source: `User-confirmed quote for ${supplier.name}`,
      retrievedAt: ctx.now,
      excerpt: input.sourceText.slice(0, 8000),
      fictional: supplier.fictional,
    };
    quote.evidenceIds = [evidence.id];
    await this.repo.put(ctx, 'evidence', evidence);
    return this.repo.put(ctx, 'quotes', quote);
  }
  async saveBrief(ctx: Context, brief: Brief) {
    return this.repo.saveBrief(ctx, BriefSchema.parse(brief));
  }
}
