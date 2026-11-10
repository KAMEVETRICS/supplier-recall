# A sourcing assistant should remember what happened after the quote

Draft for publication after live verification. Replace all evidence placeholders with observed results and public links.

A small store can compare supplier prices in a spreadsheet. The harder problem is carrying experience forward: the cheap supplier that missed two launches, the local supplier that met its promise, and the fact that a routine restock has different priorities from a launch.

Supplier Recall brings those decisions into one workbench. A sourcing brief leads to supplier research or imported quotes, an evidence-based comparison, a draft follow-up, and a record of the actual outcome. Each completed cycle creates context for the next one.

The sample store buys kraft mailers. Northline has the cheapest quote; Cedar has a better observed delivery record. With quote evidence alone, Northline leads. With recalled delivery history and a launch preference, Cedar leads. A price-first correction for restocks changes that context while leaving launch priorities intact.

Walrus Memory provides the persistence and retrieval boundary. The application keeps a transactional outbox so a saved local event cannot lose its memory job. Stable operation keys make retries safe. A relayer acknowledgment means accepted work; the interface calls it saved only when the job supplies a completed blob receipt. Each live comparison recalls context again, and missing or partial recall remains visible.

Tavily supplies web sources. A language model extracts draft quote fields while preserving missing facts for review. Deterministic rules handle eligibility and ranking; follow-up templates ask grounded questions without inventing commitments. Tatum adds read-only Sui transaction evidence by matching execution, participants, asset, and exact atomic amount against an invoice. Payment is separate from delivery.

The public sample runs in the visitor's browser. Paid providers and operator records are behind authenticated server routes with usage budgets. Fictional supplier evidence is never attached automatically to a real discovered business.

**Evidence to add before publication:** public demo and repository links; at least ten completed Mainnet memory receipts; a fresh-process recall result with cited memory IDs; live search sources; an existing transaction match and deliberate mismatch; screenshots and final recording.

The central lesson is simple: remembering a preference is useful, but remembering the evidence behind a decision is what makes the next decision defensible.
