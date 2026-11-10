PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS documents (store_id TEXT NOT NULL, kind TEXT NOT NULL, id TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(store_id,kind,id));
CREATE TABLE IF NOT EXISTS memory_outbox (store_id TEXT NOT NULL, record_id TEXT NOT NULL, operation_key TEXT NOT NULL, job_id TEXT, state TEXT NOT NULL DEFAULT 'pending', receipt TEXT, error_code TEXT, PRIMARY KEY(store_id,record_id), UNIQUE(store_id,operation_key));
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, store_id TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS budgets (key TEXT NOT NULL, window INTEGER NOT NULL, used INTEGER NOT NULL, PRIMARY KEY(key,window));
CREATE TABLE IF NOT EXISTS payment_claims (network TEXT NOT NULL, digest TEXT NOT NULL, store_id TEXT NOT NULL, invoice_id TEXT NOT NULL, PRIMARY KEY(network,digest));
