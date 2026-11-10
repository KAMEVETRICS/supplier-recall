# Implementation and verification status

Local work completed November 9, 2026. Live submission evidence and publication remain pending.

| Area | State | Evidence |
|---|---|---|
| Runtime, contracts, persistence | Implemented | Foundation tests; local Node 24.22.2 |
| Provider adapters | Implemented, live checks blocked | Provider boundary tests; no local credentials yet |
| Operator access | Implemented | Hashed sessions, source-scoped durable throttling, origin checks |
| Supplier discovery and quote review | Implemented | Domain identity, CSV limits, explicit source-to-supplier confirmation |
| Walrus memory lifecycle | Implemented, Mainnet proof pending | Idempotent outbox, receipts, supersession, database-reopen tests |
| Comparison and follow-up | Implemented | Deterministic ranking, unknown facts, contextual preferences, grounded templates |
| Outcomes and payments | Implemented, live Tatum proof pending | Atomic event/outbox writes, stable retries, unique transaction claims |
| Workbench | Verified locally | 18 desktop/mobile browser tests; screenshots in `artifacts/screenshots/` |
| Operational scripts and submission material | Prepared | Setup, seed/probe/verifier, demo sequence, blog draft, release checklist |

Final local checks: 54 backend tests pass; 18 browser tests pass; lint and TypeScript checks pass. The final production build passes. Sample tests and fake-provider tests do not establish live service availability.

## Independent review

One independent read-only review identified seven material findings. Regression tests reproduced each defect before its fix:

1. New quotes inherited another supplier's facts: quotes now start with unknown commercial fields and an empty source; the user confirms the association.
2. Lost responses could duplicate observations: the exact submission is retained in browser session storage and reused after reload. A failed post-save refresh is reported separately.
3. Punctuation-distinct domains shared IDs: IDs now derive from a SHA-256 hash of the normalized domain, with equality checked before reuse.
4. An incomplete competitor could produce a ready recommendation: unresolved eligible quotes keep the comparison provisional.
5. Anonymous login failures shared one global bucket: durable throttling is now source-scoped; public deployment requires a trusted proxy-owned source header.
6. Rechecking a payment created a new invoice: the invoice persists across retries/reloads, with existing invoice selection.
7. Exclusion reasons were hidden: evidence panels now show exclusion reasons and open questions even when every candidate is blocked.

The reviewer did not assess live providers, Mainnet durability, deployed persistence, publication, or visual acceptance. Live/deployment items remain blocked; the author subsequently inspected desktop/mobile screenshots and verified the browser suite. No second review is claimed.

## Implementation decisions

- Used a feature branch in the initially empty workspace; no duplicate worktree. Cost: local work is kept in this directory.
- Installed the project-local Node runtime; machine-wide Node is unchanged. Deployment must provide the compatible runtime.
- Kept the approved Node/Next application workflow. Hosting remains a separate configured release step.
- Used official SWC WASM fallback, webpack, JavaScript configuration, and plain CSS for the Windows compiler restriction. Cost: fallback builds may be slower.
- Used typed store-scoped document rows with separate transactional outbox, sessions, budgets, and payment claims. Validation remains at application boundaries.
- Consolidated authenticated mutations and workbench dialogs to share contracts and guards. Cost: these modules are larger.
- Used deterministic follow-up templates: valid citation IDs alone cannot prove arbitrary model prose is grounded. Cost: less stylistic variation; AI still extracts quote fields.
- Used Los Angeles calendar dates consistently for fixtures and comparisons, including around UTC midnight.
- Kept memory reconciliation explicit through **Check storage** and the bounded seed command. Cost: the operator checks pending jobs manually; there are no hidden background provider calls.
- Retained the execution ledger while external proof remains outstanding. Created one reviewed implementation checkpoint rather than reconstructing per-task commits after initial Git identity setup failed.

No provider credentials, private database contents, generated passwords, verification artifacts, or screenshots are tracked in Git. No publication, supplier messaging, purchasing, or payment execution occurred.
