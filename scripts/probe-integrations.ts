import {config,check,report,liveRequested} from './shared';
import {createProviders} from '../src/server/providers';
const p=createProviders(config);
await check('Walrus Mainnet health',liveRequested&&!!config.memwalKey&&!!config.memwalAccount,async()=>{await p.memory.health();return 'Mainnet relayer responded.';});
await check('Tavily discovery',liveRequested&&!!config.tavilyKey,async()=>{const hits=await p.search.search('kraft mailer packaging manufacturer United States');if(!hits.length)throw Error();return `${hits.length} source results received.`;});
await check('LLM structured extraction',liveRequested&&!!config.llmKey&&!!config.llmModel,async()=>{const q=await p.llm.extractQuote('Fictional Example Packaging quote: 500 kraft mailers at USD 0.75 each. Shipping, tax, and delivery are not supplied.');if(q.unitPriceCents!==75||q.shippingCents!==null||q.taxCents!==null)throw Error();return 'Known price extracted; missing costs preserved as unknown.';});
await check('Tatum read-only lookup',liveRequested&&!!config.tatumKey&&!!config.sampleDigest,async()=>{const tx=await p.payment.lookup(config.sampleDigest);if(tx.digest!==config.sampleDigest)throw Error();return 'Configured transaction retrieved; invoice matching is a separate check.';});
await report('provider-probe');
