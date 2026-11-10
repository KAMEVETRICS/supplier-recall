# Supplier Recall

A sourcing workbench that remembers supplier experience. Compare packaging quotes, inspect the evidence, record what happened, and carry that lesson into the next purchasing decision.

Built for Total Recall Track 2. The public sample uses fictional suppliers and browser-local storage. The private operator workspace integrates Tavily discovery, OpenAI quote extraction, Walrus Memory, and read-only Tatum Sui transaction evidence.

## Run locally

```powershell
npm ci
npm run runtime
npm run dev
```

Open [the sample workspace](http://127.0.0.1:3000). npm scripts use the project-local Node 24.22.2 runtime. The install script prepares Next's official WASM compiler fallback for Windows hosts that block native SWC; development and builds use webpack.

No provider keys are required for sample mode. Try turning memory off/on, switching to routine restock, then opening **Memory → Teach a preference → Price first**. Reload to see the remembered change.

## Live operator setup

See [the setup guide](docs/setup.md). Copy `.env.example` to `.env.local`, configure the services, generate operator access with `npm run operator:password`, and restart. Open [/operator](http://127.0.0.1:3000/operator). Secrets never belong in `NEXT_PUBLIC_*` variables.

```powershell
npm run db:migrate
npm run probe -- --live
npm run demo:seed -- --live
npm run submission:verify -- --live
```

Seeding submits only fictional demo records to the configured Walrus namespace. A relayer job being accepted is not proof of persistence: only completed jobs with blob receipts count. Rerun seeding to reconcile pending jobs without changing their operation IDs. The verifier starts fresh and uses recalled memory for its recommendation checks. Missing credentials or publication proof produce a blocked result and a nonzero exit code.

## Validate

```powershell
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

Browser tests use installed Microsoft Edge at desktop and 390px mobile widths on port 3217. Sample mode must not call paid APIs. Tests cover scoped memory, durable outbox recovery, quote uncertainty, authentication, payment matching, and the learning loop. Passing local tests does not establish live submission readiness.

## How it works

- **Research:** up to three Tavily queries and five deduplicated supplier candidates. Sources remain claims until reviewed. Text and CSV imports are limited to 100 KB; CSV to 20 records.
- **Compare:** deterministic eligibility and ranking. Missing shipping or tax stays unknown. Delivery observations retain counts, dates, and memory references. Purpose-specific corrections supersede the previous preference without changing other purchase types.
- **Remember:** store-scoped libSQL entities plus a transactional outbox. Walrus records use versioned envelopes and stable idempotency keys. Live comparisons retrieve memory rather than silently using sample data.
- **Follow through:** user-reviewed draft questions, delivery and quality observations, and read-only payment checks. No supplier messages, orders, or payments are sent.
- **Access:** public sample state stays in the visitor's browser. Operator sessions use HttpOnly cookies, hashed tokens, same-origin mutations, and persistent usage budgets.

The initial release supports English, USD quotes, US destinations, and simple Sui transfers. Business-day delivery promises require clarification. A matching payment does not prove shipment, quality, or supplier identity.

Source map: `src/domain` contains contracts and fixtures; `src/features` the business rules; `src/server` storage/providers/auth; `src/components` the workbench; `scripts` the operational checks.

## Submission material

[Demo sequence](docs/demo.md) · [Blog draft](docs/blog-draft.md) · [Submission checklist](docs/submission.md) · [Approved design](docs/superpowers/specs/2026-11-08-supplier-recall-design.md)

Live credentials, completed Mainnet evidence, deployment, public repository/blog URLs, and final form submission remain external setup and release steps until separately verified.
