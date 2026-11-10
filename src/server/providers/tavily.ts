import { z } from 'zod';
import { requestJson, ProviderError } from './http';
import type { SearchProvider } from './contracts';
const schema = z.object({
  results: z.array(z.object({ title: z.string(), url: z.url(), content: z.string() })).max(20),
});
export function createTavily(key: string, fetcher: typeof fetch = fetch): SearchProvider {
  return {
    search: async (query) => {
      if (!key) throw new ProviderError('not_configured');
      const json = await requestJson(
        'https://api.tavily.com/search',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: query.slice(0, 500),
            search_depth: 'basic',
            max_results: 5,
            include_answer: false,
            include_raw_content: false,
            topic: 'general',
            country: 'united states',
          }),
        },
        20000,
        fetcher,
      );
      const result = schema.safeParse(json);
      if (!result.success) throw new ProviderError('invalid_response');
      return result.data.results;
    },
  };
}
