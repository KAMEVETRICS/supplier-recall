# Local and live setup

1. Run `npm ci`. Confirm `npm run runtime` prints v24.22.2. npm must permit the `node` and `esbuild` package install scripts. The project-local runtime avoids changing your global Node installation.
2. Copy `.env.example` to `.env.local` if it does not already exist. Preserve existing credentials.
3. For live work set `APP_MODE=live` and `APP_ORIGIN` to the exact browser origin, including the port. The default is `http://127.0.0.1:3000`.
4. Set `TAVILY_API_KEY`. For quote extraction set `LLM_API_KEY` and `LLM_MODEL`; `LLM_BASE_URL` defaults to NVIDIA's OpenAI-compatible API (`https://integrate.api.nvidia.com/v1`, keys from build.nvidia.com start with `nvapi-`). On November 9, 2026, `nvidia/nemotron-3.5-super-vl-120b-a12b` passed every extraction check in about 7–15 seconds; several other listed NVIDIA models returned "Not found for account" on a free key or exceeded the 30-second limit. Any HTTPS chat-completions endpoint that returns JSON works, including OpenRouter and OpenAI. Quote text is sent to that provider, so use fictional demo quotes. Set `TATUM_API_KEY` for read-only Sui Mainnet lookups through Tatum's Sui GraphQL endpoint (`https://sui-mainnet.gateway.tatum.io/graphql`); Sui retired JSON-RPC in 2026.
5. Configure `MEMWAL_PRIVATE_KEY` and `MEMWAL_ACCOUNT_ID` for Walrus Memory. Keep `MEMWAL_SERVER_URL=https://relayer.memory.walrus.xyz`. Use a dedicated `MEMWAL_NAMESPACE` containing `demo` for fictional demo records. Keep real supplier documents out of the demonstration account.
6. Run `npm run operator:password`. It preserves a fully configured operator setup; otherwise it generates a password and session secret locally. The password is saved to ignored `artifacts/operator-password.txt`. Read it locally, store it securely, and remove that plaintext file when no longer needed. No password is printed to the terminal.
7. Run `npm run db:migrate`, then restart `npm run dev`. Sign in at `/operator`. You can load the fictional scenario there or run the seed command below.

## Integration proof

`npm run probe -- --live` makes bounded provider checks, including one search and one synthetic quote extraction. `npm run demo:seed -- --live` queues twelve distinct fictional records plus one restock correction, submits pending records, and checks existing jobs once. Reruns reuse stored record/operation/job IDs. A blocked result while jobs are accepted is expected; rerun later. Do not change namespaces while reusing a database/outbox.

`npm run submission:verify -- --live` requires at least ten distinct completed blob receipts, fresh recall, changed launch and restock decisions, live search, and a supported Tatum transaction plus deliberately incorrect amount. Reports are redacted JSON in ignored `artifacts/verification/`. The verifier never substitutes sample memory for a failed live recall.

For the payment check, use an existing authorized simple Sui Mainnet transfer. Set `SUI_SAMPLE_DIGEST`, then point `SUI_SAMPLE_INVOICE_PATH` to a private JSON file containing independently known invoice fields:

```json
{
  "id": "demo-invoice",
  "supplierId": "fixture-b",
  "expectedSender": "0x…",
  "expectedRecipient": "0x…",
  "assetType": "0x2::sui::SUI",
  "amountAtomic": "1000000000"
}
```

Replace the placeholders with the actual expected participants and atomic amount. Do not infer the expected amount from the transaction merely to make the check pass. Complex programmable transactions are deliberately unverified. This app cannot create a transfer.

On a deployment there is no private file, so put the same invoice on one line in `SUI_SAMPLE_INVOICE_JSON`, alongside `SUI_SAMPLE_DIGEST`. The public `/live` page reads both and shows the match and a deliberate one-MIST mismatch. The digest and both addresses are public on-chain, and the page shows them.

## Deployment

Use a Node host supporting Node 24.22.2, `npm ci`, `npm run build`, and `npm start`. Keep the repository's SQL migration file available at runtime. Configure HTTPS and the exact `APP_ORIGIN`; production cookies are Secure. Do not deploy local production HTTP for login testing.

For public operator login, configure `AUTH_TRUSTED_SOURCE_HEADER` to a single client-IP header your trusted reverse proxy **overwrites**, for example `x-real-ip`. Block direct access around that proxy. Do not trust a header that arbitrary clients can supply or append. Login attempts are limited per source in durable storage; one visitor cannot exhaust another source's bucket. Without this setting, only a localhost-configured application permits login. The public `/live` page uses the same header to rate-limit visitors, so set it on every public deployment (`x-real-ip` on Vercel). To give visitors only the sample and `/live`, leave `OPERATOR_PASSWORD_HASH` and `SESSION_SECRET` unset there; operator login then stays disabled.

Use either a persistent disk with `DATABASE_URL=file:/persistent/path/recall.db`, or a durable libSQL URL with `DATABASE_AUTH_TOKEN`. To move an existing database, copy its rows into the new one instead of re-seeding: seeded memories carry dates, so re-seeding the same Walrus namespace on another day conflicts with the stored idempotency keys. An ephemeral server filesystem cannot preserve outbox, login budgets, or transaction claims. Set provider keys only in server environment variables. Avoid exposing the database and verification artifacts through static hosting.

Before publication: smoke-test operator login, research, quote confirmation, a completed Walrus receipt, recall after a process restart, logout, and unauthenticated API denial. Confirm the public sample never retrieves operator records. Deployment and publication are separate authorized actions; this repository has not published itself.

## Troubleshooting

- A native SWC warning on a locked-down Windows host is expected if the WASM fallback loads successfully. Run `npm run postinstall` if that fallback is missing.
- `forbidden` on a mutation usually means the browser origin differs from `APP_ORIGIN`. Correct the port/host and restart.
- `not_configured` means a required service key or model setting is absent. Sample mode remains usable.
- `invalid_response` from quote extraction means the model's reply did not match the quote fields. Try another `LLM_MODEL`.
- `partial` recall means some context could not be retrieved. Retry before a final decision; inspect the memory status rather than assuming the local ledger is proof of remote recall.
- Pending memory jobs need reconciliation in the Memory view or the seed command. Do not mark them saved manually.
