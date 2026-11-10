# Supplier Recall — proposed design

Status: approved by the user on November 8, 2026. Implementation planning requested; product implementation has not started.

## Intent and decisions

Build a Track 2 assistant that combines supplier discovery, quote research, relationship memory, and follow-through. It helps a small business decide who to buy from and remembers the results for its next decision.

The user selected BOTH web discovery and comparison of supplied quotes. They want research and relationship memory combined in a supply-chain context. They have no particular industry experience to anchor the demo.

Approved defaults: working name Supplier Recall; a fictional online store buying packaging; a single-store web app; English, USD, US suppliers and delivery destinations; TypeScript with a server-backed React application. These keep the demonstration understandable and bounded.

## Approaches considered

1. Supplied quotes only: predictable inputs and fast comparison, but limited discovery.
2. Web discovery only: finds new candidates, but public prices and delivery claims often need confirmation.
3. Both, sharing one evidence model: selected by the user. Search finds candidates; quotes and order history provide deeper evidence. Research can be run separately or alongside quote comparison. Both feed the same recommendation and memory loop.

## First-version scope

1. Create a sourcing brief: packaging specification, quantity, destination, budget, needed-by date, and purpose (launch or routine restock).
2. Discover candidates through a real server-side web-search provider. Bound each run to three queries and five candidate suppliers. Preserve URLs, retrieval timestamps, and supporting text. Search listings identify leads; they do not establish stock, exact delivered price, or supplier reliability.
3. Accept pasted quote text and UTF-8 text/CSV files, plus fixture quotes. PDF/OCR is deferred. Extract specification, quantity, unit price, currency, shipping/tax where provided, minimum order, promised lead time, quote expiry, and payment terms. Let the user correct extracted fields before comparison.
4. Merge candidate evidence only after a match on a confirmed supplier identity/domain; uncertain matches stay separate. Public claims, supplier quotes, user reports, and observed order outcomes retain separate provenance.
5. Recall relevant supplier history and purpose-specific user preferences. Compare candidates on known costs, specification fit, delivery evidence, and unresolved issues. Cite sources and memory records for each material reason. Show missing information instead of inventing values.
6. Draft a clarification or follow-up message. The user copies it; the app does not send messages or place orders.
7. Record a chosen supplier, commitments, subsequent delivery/quality outcomes, and corrections. Recall those in a new session to improve the next recommendation.
8. Verify a supplied Sui transaction for a sample supplier-payment workflow through Tatum. Payment evidence affects payment follow-up status only.

## Reasoning and memory behavior

Use explicit criteria and evidence, not a mysterious global trust score. Hard requirement failures exclude a candidate from a confirmed recommendation. Missing required facts produce a provisional shortlist and questions. Unknown shipping/tax means total cost is incomplete; avoid an unqualified cheapest claim. Only compare equivalent quantities/specifications and currency; no foreign-exchange feature in version one.

The proposed launch default prioritizes delivery evidence, then known cost. Routine restocks prioritize known cost among candidates meeting requirements. User corrections override defaults within their stated context. A missed shipment is an observation, not a claim that a supplier is always unreliable. Show sample counts and dates when summarizing outcomes. LLM text explains structured evidence; it cannot fabricate citations or convert a web claim into an observed fact.

Walrus Memory stores concise research findings with provenance, preferences, commitments, decisions, and outcomes. Each record carries a store namespace, supplier ID where relevant, type, timestamp, source reference, and optional superseded-record reference. A correction supersedes its predecessor; recalled superseded content must be filtered before reasoning. A recommendation is not fed back as an independently verified supplier fact.

Store ordinary application entities, source excerpts, and write-status bookkeeping in a durable application database. Walrus is the persistent memory source for later sessions, not a cosmetic audit copy. Retrieve memories during each comparison. Only show a memory as saved after the service confirms the write. Failed writes remain visibly pending and can be retried without duplicating a logical record. Never silently replace failed live recall with fixture memories.

## Integrations and deployment boundaries

Use separate server-side adapters for web search, LLM extraction/explanation, Walrus, and Tatum. Provider/model choice, database vendor, deployment host, and component library are left to the implementation planner, based on available credentials and verified runtime compatibility. Budget provider calls per request; no background crawling.

The default Walrus client processes plaintext at its relayer. Use fictional business records for the hackathon; describe this data flow in setup documentation. Delegate credentials and provider keys remain server-side. Do not require a supplier wallet or crypto transaction for ordinary sourcing.

Tatum verification is read-only. Check successful execution plus expected sender, recipient, asset, and amount before matching a transaction to a sample invoice. A digest may not settle multiple invoices. Ambiguous transactions, RPC errors, and missing results remain unverified. No exchange-rate conversion or split/partial-payment accounting in version one. A transaction does not prove legal supplier identity, delivery, or product quality. Use an existing authorized transaction example; no transfer is required by this design. Clearly distinguish sample invoice associations from actual commercial payments.

Tatum currently documents a Sui JSON-RPC transaction endpoint. Treat that as a starting point, not a tested dependency: verify its live availability with credentials early, and use a documented supported Tatum interface if necessary. Likewise, validate Walrus Mainnet writes and recall before spending time polishing the application.

Development can run with clearly labeled sample adapters. Submission readiness requires real web discovery, real Walrus Mainnet memory writes/recall, and a successful Tatum Sui read. Missing credentials are setup dependencies, not reasons to claim simulated integrations are complete.

Public preview: visitors can explore isolated fictional fixtures; only the authenticated operator can use paid APIs or mutate the submission memory space. Use a server-validated operator session, no open shared write endpoint. Arbitrary fetched URLs must reject private/local addresses and unsafe redirects; treat retrieved text as data rather than tool instructions. Implementation details are left to the builder.

## Demonstration and acceptance

Use three explicitly fictional suppliers for historical-order and quote scenarios. Never attach fictional negative history to real suppliers found on the web. Real discovered suppliers remain separate candidates with unknown history until the user supplies evidence.

Demonstrate both paths: a live search with usable source links, then comparison of supplied sample quotes. Supplier A initially looks cheaper; recalled late deliveries change the recommendation for a launch. Record a context-specific correction, start a fresh session, and demonstrate its effect on a routine restock comparison. Show which actual retrieved memories caused the difference.

Before submission, store and verify at least ten distinct useful memories on Mainnet, including observations, preferences, research findings, and decisions. Show identifiers/write confirmations and recall after a fresh session. Verify one appropriate Sui transaction via Tatum, including a mismatch case that remains unverified. Exercise provider failure and unknown-price cases without fabricated outputs. Tests should target these behaviors, evidence association, and contextual preference handling.

The submission additionally needs a working demo, public repository, and published blog explaining the integrations and learning loop. Those external publishing steps are separate from this design draft. Deadline: November 10, 2026, 17:00 UTC / 9:00 a.m. America/Los_Angeles, as verified on November 8. Focus implementation on these deliverables rather than bonus payment execution.

## Exclusions and failure conditions

No full ERP, inventory forecasting, freight tracking, email integration, autonomous procurement, payment execution, multi-store SaaS onboarding, or PDF/OCR in version one. A polished interface without real cross-session learning is a failure. So are fabricated supplier facts, missing source evidence, undisclosed simulation, or a payment result that implies physical delivery.

## Sources checked November 8, 2026

- Hackathon requirements and deadline: https://recall-tatum-walrus.vercel.app/
- Walrus Memory behavior and processing model: https://docs.wal.app/walrus-memory
- Walrus setup: https://docs.wal.app/walrus-memory/getting-started/quick-start
- Tatum Sui interfaces: https://docs.tatum.io/reference/rpc-sui
- Tatum transaction lookup: https://docs.tatum.io/reference/rpc-sui-sui_gettransactionblock

## Next step

Write the implementation plan from this approved scope. Both research paths, the demo setting, operational defaults, and implementation scope were approved on November 8, 2026.
