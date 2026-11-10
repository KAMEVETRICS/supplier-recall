# Supplier Recall Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a supplier assistant that discovers candidates online, compares quotes, and improves sourcing and follow-up decisions using real cross-session memory.

**Execution status (2026-11-09):** Local implementation and regression review are complete; 54 backend and 18 desktop/mobile browser tests pass. Provider/live proof portions of tasks 2, 7, and 9 remain blocked on credentials and release setup. See [implementation status](../../implementation-status.md) for verified results, review fixes, and decisions. The original detailed steps below are retained as the planned baseline; the status report is the execution record.

**Architecture:** One Next.js application with server-only provider adapters and a durable libSQL database. A deterministic comparison engine owns eligibility and ranking; the language model extracts and explains cited evidence. Walrus supplies recalled memory, while Tatum independently verifies sample Sui payments.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, Zod, `@libsql/client`, `ai` with `@ai-sdk/openai`, Tavily Search over HTTPS, `@mysten-incubation/memwal`, Node crypto, Vitest, Playwright, npm.

**Spec:** [Approved design](../specs/2026-11-08-supplier-recall-design.md). Read both documents before execution.

## Global Constraints

- "English, USD, US suppliers and delivery destinations; TypeScript with a server-backed React application."
- "Bound each run to three queries and five candidate suppliers."
- "PDF/OCR is deferred."
- "Let the user correct extracted fields before comparison."
- "Only compare equivalent quantities/specifications and currency; no foreign-exchange feature in version one."
- "User corrections override defaults within their stated context."
- "Only show a memory as saved after the service confirms the write."
- "Never silently replace failed live recall with fixture memories."
- "A digest may not settle multiple invoices."
- "Never attach fictional negative history to real suppliers found on the web."
- "Submission readiness requires real web discovery, real Walrus Mainnet memory writes/recall, and a successful Tatum Sui read."
- No autonomous purchasing, message sending, payment execution, background crawling, inventory forecasting, or multi-store onboarding.
- Submission target: November 10, 2026, 17:00 UTC / 9:00 a.m. Los Angeles. Ten or more distinct useful Mainnet memories, working demo, public repository, and published blog are acceptance requirements.

## Review Focus

1. A browser refresh after an accepted write must not create another memory; task 5 tests recovery and idempotency.
2. Similar supplier names, expired quotes, and unknown shipping must not yield a confident cheapest recommendation; tasks 4 and 6 test provenance and incomplete evidence.
3. A correction omitted by semantic retrieval must not resurrect a superseded preference; task 5 checks the persistent supersession ledger and incomplete recall.
4. Concurrent payment checks or repeated requests must not settle multiple invoices; task 7 exercises atomic digest uniqueness and gas-aware matching.
5. Public visitors, forged requests, or embedded source instructions must not consume live credentials or contaminate the operator's memory; tasks 3, 4, and 8 test isolation.

## Current state and implementation decisions

The workspace contains the approved design and no application or Git repository. No applicable AGENTS.md was found. Node v24.19.0, npm 11.17.0, and Git 2.56.0 are installed. The checked provider, database, and operator environment variables are absent; this does not establish whether the user has accounts elsewhere. No credentials were read or printed.

Walrus documents a Node 24 minimum of 24.22.1 (also lists supported Node 22/26 floors). Before installing dependencies, verify and provision a supported Node 24 release through the official distribution or an existing version manager. Do not claim runtime compatibility on the current installation. Freeze exact compatible package versions in `package-lock.json` during task 1; use installed package types as the API authority.

Use local `file:./data/recall.db` libSQL during development and a hosted libSQL database for deployment. Proposed deployment is a Node-runtime Next.js host such as Vercel plus hosted libSQL; verify runtime and request limits before selecting it. No deployment account or paid resource is created by this plan. If that host cannot provide the required runtime, use a Node container with the same remote database. Never deploy writable SQLite to ephemeral storage.

Use OpenAI through the explicit `@ai-sdk/openai` provider, not the SDK's implicit gateway. Require `OPENAI_MODEL`; choose an account-accessible structured-output model during the live probe, recording its ID. Tavily handles outbound search; the app does not fetch arbitrary supplier URLs. A source page may be linked, and provider-returned excerpts supply initial evidence. This keeps live discovery in scope without a crawler.

Public sample mode is local to each visitor's browser and uses fictional fixtures. Live mode is restricted to one operator session and server-owned store ID. Build all business logic against injected adapters so sample and live modes share behavior without sharing state.

## File map

All paths below are relative to `C:/Users/THIS-PC/Documents/recall`.

| Files | Responsibility |
|---|---|
| `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `.gitignore`, `.env.example`, `.node-version`, `vitest.config.ts`, `playwright.config.ts` | Reproducible runtime, scripts, and checks |
| `src/domain/types.ts`, `src/domain/schemas.ts`, `src/domain/fixtures.ts` | Shared contracts, validation, fictional dataset |
| `src/server/config.ts`, `src/server/db/client.ts`, `src/server/db/repository.ts`, `src/server/db/migrations/001_initial.sql` | Configuration and store-scoped persistence |
| `src/server/providers/{contracts,walrus,tatum,tavily,llm,sample}.ts` | External adapters and explicit sample adapters |
| `src/server/auth/{session,guard}.ts`, `src/server/http.ts` | Operator sessions, authorization, errors, budgets |
| `src/features/research/{service,quotes,identity}.ts` | Search, quote extraction/confirmation, supplier matching |
| `src/features/memory/{service,outbox}.ts` | Writes, status reconciliation, recall, supersession |
| `src/features/comparison/{engine,service,drafts}.ts` | Deterministic decisions and grounded message drafts |
| `src/features/orders/{service,payments}.ts` | Commitments, outcomes, read-only invoice matching |
| `src/app/api/.../route.ts` | Thin authenticated HTTP boundaries listed per task |
| `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `src/app/operator/page.tsx`, `src/components/*.tsx`, `src/client/api.ts`, `src/client/sample-store.ts` | User workflow and browser-isolated sample mode |
| `scripts/{migrate,probe-integrations,seed-demo,verify-submission}.ts` | Explicit setup and evidence-producing operations |
| `tests/{foundation,providers,auth,research,memory,comparison,orders}.test.ts`, `tests/e2e/workflow.spec.ts` | Behavioral and browser acceptance checks |
| `README.md`, `docs/setup.md`, `docs/demo-script.md`, `docs/submission-checklist.md`, `docs/blog-draft.md` | Setup, demonstration, and submission handoff |

## Shared contracts and conventions

Define these in task 1. Domain functions take explicit data; server functions take `RequestContext = { storeId: string; now: string }`. Dates use ISO strings; needed-by/expiry dates use `YYYY-MM-DD` with Los Angeles calendar semantics. USD costs use integer cents. Blockchain amounts use decimal strings parsed as BigInt, never JS floating point.

- `Brief`: ID, specification (material, dimensions, units), quantity, US destination, budgetCents, neededBy, purpose (`launch | restock`).
- `Supplier`: ID, name, domain or null, identityConfirmed, fictional. Merge on confirmed identity, not display-name similarity.
- `Evidence`: ID, supplierId, kind (`web_claim | quote | user_report | outcome`), source URL/reference, retrievedAt, excerpt, fictional. URLs never carry credentials.
- `Quote`: ID, supplierId, briefId, specification, quantity, currency, unitPriceCents, shippingCents/taxCents nullable, minimumOrder, quotedAt, productionDays, transitDays, deliveryDaysKind (`calendar | business | unknown`), expiry, paymentTerms, evidenceIds, confirmedAt nullable. Missing extracted fields remain null until corrected; malformed data is rejected. Version one computes arrival only from confirmed calendar-day durations; business/unknown units produce a clarification instead of a guessed conversion.
- `MemoryRecord`: ID, storeId, supplierId nullable, kind (`research | preference | commitment | decision | outcome`), purpose nullable, text, occurredAt, evidenceIds, supersedesId nullable. Supersession requires same store and compatible subject/context, with no cycles.
- `MemoryWrite`: recordId, operationKey, jobId nullable, state (`pending | accepted | saved | failed`), receipt nullable, errorCode nullable. The receipt preserves returned job/storage identifiers rather than inventing a transaction digest.
- `RecallResult`: memories, status (`complete | partial | unavailable`), missingActiveIds. Only successfully recalled content supplies remembered facts.
- `Comparison`: briefId, status (`ready | provisional | blocked`), ranked supplier IDs, excluded supplier IDs/reasons, reasons containing evidenceIds/memoryIds, questions, recalledMemoryIds, memoryStatus.
- `OrderEvent`: ID, briefId, supplierId, kind (`decision | commitment | delivery | quality | correction`), occurredAt, typed payload, evidenceIds. Correction payload contains purpose and superseded preference ID.
- `Invoice`: ID, supplierId, expectedSender, expectedRecipient, assetType, amountAtomic. `PaymentCheck`: status (`verified | unverified`), reason, digest, checkedAt, invoiceId.
- Provider errors use codes `not_configured | unauthorized | rate_limited | timeout | invalid_response | unavailable`; preserve safe retry metadata, redact payloads and credentials.
- `WorkspaceSnapshot`: briefs, suppliers, evidence, quotes, orderEvents, memoryWrites, invoices, and paymentChecks, all store-scoped. It never includes session hashes, provider config, or private keys. A new browser session reloads this state through an authenticated route; recalled memory content still comes from Walrus when comparing.

Provider contracts: `SearchProvider.search(query: string): Promise<SearchHit[]>`; `LlmProvider.extractQuote(text: string): Promise<QuoteDraft>` and `draft(input: DraftInput): Promise<CitedDraft>`; `MemoryProvider.submit(record: MemoryRecord, operationKey: string): Promise<{jobId: string}>`, `status(jobId: string): Promise<MemoryJobStatus>`, `recall(query: string, limit: number): Promise<MemoryRecord[]>`; `PaymentProvider.lookup(digest: string): Promise<TransactionEvidence>`. Define provider-normalized response types in `providers/contracts.ts`; validate against Zod at the adapter boundary. `DraftInput` contains only the comparison, known commitments, and allowed citation IDs; `CitedDraft` has text plus cited IDs. `TransactionEvidence` retains execution status, sender, transfer semantics, balance changes, gas payer/cost, and checkpoint evidence sufficient to reject ambiguous transfers.

## Task 1: Persist a validated sourcing brief

**Files:** Create root configuration, domain files, config/database files, `scripts/migrate.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `tests/foundation.test.ts`.

**Interfaces:** Produce `loadConfig(env): AppConfig`, `createRepository(config): Repository`, `Repository.saveBrief(ctx, brief): Promise<Brief>`, and `Repository.getBrief(ctx, id): Promise<Brief | null>`. Export the shared types above. Store-scope every table/query.

- [ ] Check the runtime prerequisite; scaffold into this directory while preserving `docs`. Configure npm scripts: `dev`, `build`, `start`, `lint` (`eslint .`), `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `test:e2e` (`playwright test`), `db:migrate`, `probe`, `demo:seed`, `submission:verify` (last four via `tsx scripts/<name>.ts`). Initialize Git after checking parent/repository state. Ignore env secrets, data, logs, generated verification artifacts, and dependencies.
- [ ] Add behavior tests for persistence after reconnect, store isolation, invalid dates, negative costs, fractional quantities, and missing budget. Include these assertions:
  ```ts
  expect(await reopened.getBrief(otherStore, brief.id)).toBeNull();
  expect(BriefSchema.safeParse({ ...brief, quantity: 0 }).success).toBe(false);
  expect(BriefSchema.safeParse({ ...brief, neededBy: '2026-02-30' }).success).toBe(false);
  ```
- [ ] Run `npm test -- tests/foundation.test.ts`; verify the failures correspond to missing validation/persistence.
- [ ] Implement migrations for briefs, suppliers, evidence, quotes, order events, memory records/outbox, supersession links, sessions, rate budgets, and invoices/payment checks. Add uniqueness on `(store_id, operation_key)` and `(network, digest)` for verified invoice claims. Persist optional values as null. Create three fictional suppliers with stable IDs, never resembling live domains.
- [ ] Run the foundation tests, `npm run typecheck`, and `npm run build`; confirm persistence and a minimal page work. Commit only task files with `feat: add validated sourcing foundation`.

## Task 2: Establish real provider connectivity before interface work

**Files:** Create provider contracts/adapters, `scripts/probe-integrations.ts`, `.env.example`, `docs/setup.md`, `tests/providers.test.ts`; extend config.

**Interfaces:** Produce `createProviders(config): Providers` implementing the shared contracts. `runProbes(config, options: {writeMemory: boolean}): Promise<ProbeReport>` returns each provider's `passed | blocked | failed` status and redacted evidence; it never substitutes samples.

- [ ] Write adapter tests for absent credentials, malformed success bodies, throttling, timeouts, and accepted-but-incomplete memory writes:
  ```ts
  expect(report.walrus.status).toBe('blocked'); // missing credentials
  expect(accepted.jobId).toBe('job-1'); // acceptance is not durability
  expect(await pending.status('job-1')).toMatchObject({ state: 'accepted' });
  ```
- [ ] Run `npm test -- tests/providers.test.ts`; verify failure before adapter implementation.
- [ ] Implement typed, bounded adapters. Use fixed provider hosts, 20-second search/Tatum deadlines, 30-second LLM/Walrus request deadlines, and no automatic LLM retries. Keep the app's runtime Node-based. LLM calls use schema-constrained outputs, no tools, and disabled provider response storage where supported.
- [ ] Implement the Walrus SDK adapter using the installed package's actual types. Use `MemWal.create` with private key, account ID, configured Mainnet relayer, and a dedicated namespace. Preserve asynchronous job IDs and explicit idempotency keys. Map actual completed receipts; pin a version supporting these operations. Tatum starts with documented `sui_getTransactionBlock` and required evidence options; if unsupported live, verify another documented Tatum Sui interface before continuing that integration.
- [ ] Document configuration: `APP_MODE=sample|live`, `APP_ORIGIN`, `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `TAVILY_API_KEY`, `TATUM_API_KEY`, `MEMWAL_PRIVATE_KEY`, `MEMWAL_ACCOUNT_ID`, `MEMWAL_SERVER_URL`, `MEMWAL_NAMESPACE`, `OPERATOR_PASSWORD_HASH`, `SESSION_SECRET`, and `SUI_SAMPLE_DIGEST`. Explain that the hackathon's delegate public-key field is not the SDK's account object ID. Keys belong in ignored local env/deployment secrets, never chat or frontend bundles.
- [ ] Run provider tests. When credentials are configured, run `npm run probe -- --live` for search, structured extraction, memory health/recall, and Tatum lookup. Run `npm run probe -- --live --write-memory` for one explicitly fictional setup memory and later receipt/recall verification. Missing credentials produce `blocked` and a nonzero live-readiness exit code; continue independent fixture development, but keep the live milestone open. Commit with `feat: add provider adapters and integration probes`.

## Task 3: Protect operator state and isolate public samples

**Files:** Create auth/http files, `src/app/api/session/route.ts`, `src/app/api/workspace/route.ts`, `tests/auth.test.ts`; extend database session/budget methods.

**Interfaces:** `authenticate(password: string): Promise<Session>`; `requireOperator(request: Request): Promise<RequestContext>`; `reserveBudget(ctx, operation, requestId): Promise<void>`; `respondError(error): Response`; `Repository.getWorkspace(ctx): Promise<WorkspaceSnapshot>`. Session tokens are opaque random values; store only hashes. GET `/api/workspace` requires the operator session and supports reload/recovery; never cache its response publicly.

- [ ] Test expired sessions, wrong passwords, missing/forged origin, store-ID injection, and paid-operation throttling:
  ```ts
  expect(await statusOf(unauthenticatedLiveRequest)).toBe(401);
  expect(await statusOf(foreignOriginMutation)).toBe(403);
  expect(providerCalls).toBe(0);
  ```
- [ ] Run `npm test -- tests/auth.test.ts`; confirm expected failures.
- [ ] Implement scrypt password-hash verification, timing-safe comparison, 8-hour sessions, HttpOnly/SameSite=Strict cookies (Secure in production), logout invalidation, and same-origin mutation checks. Derive storeId only from the session. Return no live business data to visitors. Use durable atomic rate windows: five login failures per source per 15 minutes; ten research runs and twenty LLM operations per operator per hour; fifty memory submissions per store per hour. Respect upstream retry delays. Safe error bodies must not contain keys or source documents.
- [ ] Run auth tests and typecheck. Commit with `feat: isolate operator and sample access`.

## Task 4: Discover suppliers and confirm quote evidence

**Files:** Create research service/quotes/identity files, `tests/research.test.ts`; create `api/briefs/route.ts`, `api/research/route.ts`, `api/quotes/extract/route.ts`, `api/quotes/confirm/route.ts` under `src/app/`.

**Interfaces:** `discover(ctx, briefId): Promise<{suppliers: Supplier[]; evidence: Evidence[]; warnings: string[]}>`; `extractQuote(ctx, input: {briefId: string; text: string}): Promise<QuoteDraft>`; `confirmQuote(ctx, draft: QuoteDraft, edits: QuoteEdits): Promise<Quote>`; `matchSupplier(candidate, existing): string | null`. QuoteDraft/QuoteEdits use nullable Quote fields, source text references, and explicit identity confirmation.

- [ ] Test three-query/five-supplier caps, supplier-domain deduplication, lookalike names, rejected unsafe URL schemes, stale/expired evidence, missing freight/tax, malicious instructions in excerpts, and quote confirmation:
  ```ts
  expect(searchQueries).toHaveLength(3);
  expect(result.suppliers.length).toBeLessThanOrEqual(5);
  expect(matchSupplier(unconfirmedLookalike, suppliers)).toBeNull();
  expect(draft.shippingCents).toBeNull();
  expect(draft.confirmedAt).toBeNull();
  ```
- [ ] Run `npm test -- tests/research.test.ts`; verify missing-service failures.
- [ ] Implement three deterministic queries from the brief (product/specification, quantity/region, delivery requirement); request at most five results each, deduplicate and keep at most five candidate suppliers. Use Tavily excerpts with citations, not an uncited generated answer. Persist warnings for partial results. Do not fetch arbitrary result URLs, follow redirects, or proxy supplier content. Validate source links as public HTTPS, strip credentials, and reject local/IP-literal targets.
- [ ] Implement pasted UTF-8 text and text/CSV import with a 100 KB input limit, at most twenty CSV rows, strict UTF-8 decoding, and one quote per row. Use a CSV parser rather than string splitting. Structured extraction leaves unsupported facts null, with user review before confirmation. Never allow source text to alter tool permissions or approved supplier identity. Label shipping/transit promises as claims; no inference of stock or reliability.
- [ ] Run research tests plus auth tests for new routes. Commit with `feat: add sourced discovery and quote confirmation`.

## Task 5: Make memories durable, recoverable, and context-aware

**Files:** Create memory service/outbox, `tests/memory.test.ts`, `src/app/api/memories/route.ts`, `src/app/api/memories/[id]/status/route.ts`; extend repository.

**Interfaces:** `queueMemory(ctx, record: MemoryRecord): Promise<MemoryWrite>`; `reconcileMemory(ctx, recordId: string): Promise<MemoryWrite>`; `recallForBrief(ctx, brief: Brief, supplierIds: string[]): Promise<RecallResult>`. Store-scope status lookups and operation keys.

- [ ] Test restart recovery, concurrent enqueue, acceptance versus completion, permanent failures, cross-purpose corrections, and superseded records absent from semantic results:
  ```ts
  expect(afterRestart.operationKey).toBe(beforeRestart.operationKey);
  expect(submissionCountForSameEvent).toBe(1);
  expect(write.state).toBe('accepted'); // timeout after accepted job
  expect(recall.memories.map(m => m.id)).not.toContain(supersededId);
  expect(recall.status).toBe('partial'); // active preference omitted
  ```
- [ ] Run `npm test -- tests/memory.test.ts`; verify expected failures.
- [ ] Implement durable outbox insertion in the same transaction as the source event. Persist stable keys before submission; retries reuse unchanged payload/key. Once accepted, resume the same job rather than re-enqueueing it. Bounded status refresh returns accepted on timeout and surfaces retry delays; only durable completion produces saved. Do not run an unbounded background worker.
- [ ] Serialize a versioned MemoryRecord envelope for semantic retrieval, with searchable human text. Retrieve context preferences and supplier observations using separate bounded queries (at most six per comparison, fifty results each). Validate returned store/supplier IDs, deduplicate, and filter against the full durable supersession ledger. If results hit a cap or known active preference IDs are absent, return partial and require clarification/retry; do not restore superseded text from local copies. In this app, a new browser session retains the same store namespace; unrelated apps are not an MVP requirement.
- [ ] Run memory tests and a fresh-process live write/status/recall probe when configured. Document any blocked live check. Commit with `feat: persist and recall contextual supplier memory`.

## Task 6: Compare suppliers and explain the recommendation

**Files:** Create comparison engine/service/drafts, `tests/comparison.test.ts`, `src/app/api/compare/route.ts`, `src/app/api/drafts/route.ts`.

**Interfaces:** `compareEvidence(brief: Brief, quotes: Quote[], evidence: Evidence[], recall: RecallResult, asOf: string): Comparison`; `compareBrief(ctx, briefId: string): Promise<Comparison>`; `draftFollowUp(ctx, input: DraftInput): Promise<CitedDraft>`. Comparison service loads confirmed evidence and calls task 5 recall every time, passing `ctx.now` as the evaluation date. Tests inject the same date rather than reading the wall clock.

- [ ] Test launch/restock priorities, explicit corrections, non-equivalent specs, expired quotes, unavailable memory, omitted tax, budget limits, and invented citations. Use fixtures with equal feasible delivery and known totals when testing price preference:
  ```ts
  expect(launch.rankedSupplierIds[0]).toBe('fixture-b');
  expect(restockWithPricePreference.rankedSupplierIds[0]).toBe('fixture-a');
  expect(missingShipping.status).toBe('provisional');
  expect(noRecall.memoryStatus).toBe('unavailable');
  expect(rejectedCitationIds).toContain('invented-source');
  ```
- [ ] Run `npm test -- tests/comparison.test.ts`; confirm failures correspond to missing engine behavior.
- [ ] Implement eligibility first: confirmed quote, matching specs/quantity/USD, valid quote date, feasible MOQ, and known hard budget/date failures. Hard failures exclude; unknown facts produce questions and provisional candidates. For a new order placed at `asOf`, compute arrival from confirmed production plus transit calendar days; `quotedAt` establishes quote freshness, not an already-started production clock. Test old quotes with still-valid expiry and unknown/business-day lead times. Launch ranking considers observed late-delivery rate (with count/date context), known timing, then comparable complete total. Restock ranks complete total among feasible candidates. Unknown history is unknown, not a perfect score. Apply latest active purpose-specific preference; stable supplier ID breaks otherwise equal ties.
- [ ] Make reasons structured and citation-bound. For unavailable/partial memory, expose the limitation and only offer a provisional evidence-only result. Generate drafts from the structured result with no new commitments, prices, dates, or supplier facts. Validate citations; fall back to a grounded template if the LLM fails. Never replace the deterministic rank with LLM output.
- [ ] Run comparison/memory tests and typecheck. Commit with `feat: explain evidence-based supplier recommendations`.

## Task 7: Capture outcomes and verify payment evidence

**Files:** Create orders service/payments, `tests/orders.test.ts`, `src/app/api/orders/events/route.ts`, `src/app/api/payments/verify/route.ts`; extend repository.

**Interfaces:** `recordOrderEvent(ctx, event: OrderEvent): Promise<{event: OrderEvent; memory: MemoryWrite}>`; `verifyInvoicePayment(ctx, invoiceId: string, digest: string): Promise<PaymentCheck>`. Memory writes use task 5. Payment evidence uses task 2.

- [ ] Test late-delivery/quality history, purpose-scoped correction, rollback if outbox creation fails, malformed digest, wrong sender/recipient/asset/amount, ambiguous transfer, gas deductions, and simultaneous claims:
  ```ts
  expect(outcome.memory.state).toBe('pending');
  expect(wrongRecipient.status).toBe('unverified');
  expect(ambiguousTransfer.status).toBe('unverified');
  expect(concurrentClaims.filter(x => x.status === 'verified')).toHaveLength(1);
  ```
- [ ] Run `npm test -- tests/orders.test.ts`; verify expected failures.
- [ ] Implement transactional events/outbox and timeline queries. Record actual observations separately from recommendations. Corrections must cite the replaced preference and purpose. Payment lookup accepts only supported simple transfers with successful execution and matching expected participants, asset and exact atomic amount; account for gas separately, require confirmation evidence, and reject semantics the parser cannot establish. No split payments or execution. Atomically reserve the digest for one invoice only after verification. RPC errors never mark an invoice paid or delivered.
- [ ] Run orders tests plus a live read and mismatch check against an authorized existing transaction when available. Commit with `feat: record outcomes and verify supplier payment evidence`.

## Task 8: Complete the usable end-to-end interface

**Files:** Create `src/app/operator/page.tsx`, `src/app/globals.css`, `src/components/{app-shell,brief-form,research-results,quote-editor,comparison-panel,memory-timeline,order-events,payment-check,mode-banner}.tsx`, `src/client/{api,sample-store}.ts`, `tests/e2e/workflow.spec.ts`; extend root page/layout and configuration.

**Interfaces:** `ApiClient` exposes task 4–7 operations through typed routes plus `getWorkspace(): Promise<WorkspaceSnapshot>` from task 3; `SampleStore` exposes the same operations using domain functions/sample adapters and browser storage only. Operator mode calls live routes; visitors cannot request live mode through client flags.

- [ ] Apply the relevant UI design skill before designing the interface. Build one workbench with progressive steps: brief, research/quotes, recommendation, follow-through. Sources and memory reasons must be inspectable without reading technical logs. Show distinct pending/saved/error states and plain missing-information messages.
- [ ] Add Playwright acceptance tests for both research paths, editing an extracted quote, new-session recall through a fake provider with durable test storage, copying a draft, outcome recording, and payment mismatch. Assert sample/live labels, usable keyboard controls, error recovery, and no provider calls or operator records accessible in public sample mode:
  ```ts
  await expect(page.getByText('Sample data', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm quote' })).toBeEnabled();
  await expect(page.getByText('Payment unverified', { exact: true })).toBeVisible();
  ```
- [ ] Run `npm run test:e2e`; confirm tests fail on missing workflow rather than browser setup.
- [ ] Implement the components, accessible forms and tables, cancellation/error states, bounded polling while memory status is visible, clipboard drafts, and operator login/logout. Requests have stable IDs; repeated clicks do not duplicate records or paid jobs. Refresh shows stored job state. Provide an explicit sample reset affecting only the visitor's local namespace. Missing credentials disable live operations with setup guidance.
- [ ] Run E2E checks at desktop and mobile widths, then lint, typecheck, and build. Visually inspect overflow, focus visibility, and source links. Commit with `feat: complete supplier recall workbench`.

## Task 9: Prove the learning loop and prepare submission

**Files:** Create seed/verification scripts, `README.md`, demo/submission/blog documents; extend setup guide. Store generated redacted results under ignored `artifacts/verification/`.

**Interfaces:** `seedDemo(config, options: {live: boolean}): Promise<SeedReport>` uses stable fixture IDs/operation keys; `verifySubmission(config): Promise<ReadinessReport>` returns pass/fail/blocked per criterion and exits nonzero unless all required live checks pass.

- [ ] Prepare twelve distinct, explicitly fictional memories: two launch/restock preferences, three dated delivery outcomes, one quality issue, two sourced research summaries, one commitment, one supplier decision, one context-specific correction, and one resolution. Preserve supersession history. Run `npm run demo:seed -- --live` only against the configured dedicated demo namespace; reruns must not duplicate logical memories.
- [ ] Implement verification that checks durable receipts for at least ten distinct records, recalls relevant memories in a fresh process, cites actual IDs in a changed recommendation, performs a live web search, and checks a live Tatum transaction plus deliberate mismatch. Do not count local rows or accepted jobs as durable Mainnet memories. Verify using controlled fixture inputs, dates, and stable identities so passage of time does not silently invalidate the demo.
- [ ] Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`, and `npm run build`. Then run `npm run submission:verify -- --live`. Record command results and unresolved dependencies honestly; fixture test success is not live submission readiness.
- [ ] Draft the demo sequence: discover a real candidate with unknown history; compare the three fictional quotes; show launch recommendation changing after recall; save a restock correction; open a fresh session and demonstrate the revised decision; inspect memory evidence; verify a sample payment and reject a mismatch. Explain live versus fictional evidence explicitly.
- [ ] Prepare README, blog draft, screenshots, public-repository checklist, and deployment instructions. Explain the relayer processing model and operator/sample boundary. Smoke-test the deployed runtime/database when deployment is authorized, including persistence across restart and unauthenticated isolation. Final repository/blog publication and hackathon form submission require their actual URLs and verified completion; preparing a draft is not publishing.
- [ ] Commit reviewed task files with `docs: prepare verified hackathon submission`. Record the final evidence and outstanding publishing/setup actions in the handoff.

## Sequence and checkpoints

Execute 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9. The single shared evidence/memory model makes one coordinated plan preferable to independently evolving subsystems. Recommended execution: native implementation in this chat with a final independent review; do not duplicate foundational work across agents.

- **Connectivity checkpoint:** task 2 adapters tested and live probes passing, or specific credential/runtime blockers recorded. Continue isolated work when blocked; resolve live access before declaring the build ready.
- **Learning checkpoint:** tasks 4–6 demonstrate discovery plus confirmed quotes and a fresh-session recommendation change.
- **Submission checkpoint:** task 9 live evidence plus deploy/repo/blog deliverables. Reduce visual embellishment if time is tight; preserve both selected research paths and real integrations.

No product code, dependencies, account setup, deployments, or Mainnet writes were performed while preparing this plan.

## References checked for planning

- [Walrus runtime/setup](https://docs.wal.app/walrus-memory/getting-started/quick-start)
- [Walrus SDK configuration](https://docs.wal.app/walrus-memory/sdk/quick-start)
- [Walrus job lifecycle and idempotency](https://docs.wal.app/walrus-memory/sdk/production-readiness)
- [Tatum Sui transaction lookup](https://docs.tatum.io/reference/rpc-sui-sui_gettransactionblock)
- [Tavily Search API](https://docs.tavily.com/documentation/api-reference/endpoint/search)
- [libSQL/Turso TypeScript choices](https://docs.turso.tech/sdk/ts/reference)
- [Next.js setup](https://nextjs.org/docs/app/getting-started/installation)
- [AI SDK structured data](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data)
- [Explicit OpenAI provider](https://ai-sdk.dev/providers/ai-sdk-providers/openai)

## Self-review

Coverage: source discovery/quotes (4), persistence/access (1/3), memory lifecycle and corrections (5), recommendation/citations (6), outcomes/payment (7), both user paths (8), live proof and submission assets (2/9). Each Review Focus item has a corresponding behavior test. Shared signatures, paths, mode boundaries, and minimum live evidence are specified. Runtime and absent credentials remain execution prerequisites, not claimed completed integrations.
