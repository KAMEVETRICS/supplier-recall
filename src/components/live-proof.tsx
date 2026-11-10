'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Brain,
  CheckCircle2,
  ExternalLink,
  Package,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { api } from '@/client/api';
import type { LiveDecision, LivePayment, LiveProof as Proof } from '@/features/proof/live';

const aggregator = 'https://aggregator.walrus-mainnet.walrus.space/v1/blobs/';
const short = (value: string) =>
  value.length > 14 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
const day = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'America/Los_Angeles',
  });
const failure = (e: unknown) =>
  e instanceof Error ? e.message : 'The live check could not complete.';
const sui = (mist: string) => {
  const v = BigInt(mist);
  const fraction = (v % 1_000_000_000n).toString().padStart(9, '0').replace(/0+$/, '');
  return `${v / 1_000_000_000n}${fraction ? '.' + fraction : ''} SUI`;
};

export default function LiveProof() {
  const [proof, setProof] = useState<Proof | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  // React's fetch-in-effect pattern: state changes only when the request settles, and not after unmount.
  useEffect(() => {
    let ignore = false;
    api<Proof>('live')
      .then(
        (p) => {
          if (!ignore) setProof(p);
        },
        (e) => {
          if (!ignore) setError(failure(e));
        },
      )
      .finally(() => {
        if (!ignore) setBusy(false);
      });
    return () => {
      ignore = true;
    };
  }, []);
  async function rerun() {
    setBusy(true);
    setError('');
    try {
      setProof(await api<Proof>('live'));
    } catch (e) {
      setError(failure(e));
    } finally {
      setBusy(false);
    }
  }
  const name = (id: string | null) =>
    id ? (proof?.suppliers.find((s) => s.id === id)?.name ?? id) : 'Your preferences';
  return (
    <main className="proof-page">
      <header className="proof-header">
        <Link className="brand" href="/">
          <span className="brand-icon">
            <Package size={20} />
          </span>
          supplier<span className="brand-light">recall</span>
        </Link>
        <Link className="text-button" href="/">
          <ArrowLeft size={14} /> Sample workspace
        </Link>
      </header>
      <section className="page-heading proof-heading">
        <div>
          <div className="eyebrow">
            <span className="tiny-dot" /> LIVE · SUI MAINNET · READ-ONLY
          </div>
          <h1>Experience, recalled from Walrus.</h1>
          <p>
            Each check runs now against Walrus Memory and Tatum on Sui Mainnet. The suppliers and
            orders are fictional; the stored memories and the chain reads are real.
          </p>
        </div>
        <button className="button secondary small" disabled={busy} onClick={rerun}>
          <RefreshCw size={14} />
          {busy ? 'Checking…' : 'Run the checks again'}
        </button>
      </section>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {!proof && busy && (
        <p className="loading" role="status">
          <Brain size={18} />
          Recalling memories from Walrus Mainnet…
        </p>
      )}
      {proof && (
        <>
          <p className="muted">
            Checked{' '}
            {new Date(proof.checkedAt).toLocaleString('en-US', {
              timeZone: 'America/Los_Angeles',
              dateStyle: 'medium',
              timeStyle: 'short',
            })}{' '}
            PT. Results are cached for 60 seconds.
          </p>
          <section className="records-section" aria-labelledby="decisions-heading">
            <div className="section-heading">
              <div>
                <h2 id="decisions-heading">How memory changes the decision</h2>
                <p>
                  The same three quotes, compared without memory and with memories recalled from
                  Walrus just now.
                </p>
              </div>
            </div>
            <div className="proof-grid">
              {proof.decisions.map((d) => (
                <DecisionCard key={d.label} decision={d} name={name} />
              ))}
            </div>
          </section>
          <section className="records-section" aria-labelledby="memories-heading">
            <div className="section-heading">
              <div>
                <h2 id="memories-heading">
                  {proof.memories.filter((m) => m.state === 'saved').length} memories stored on
                  Walrus Mainnet
                </h2>
                <p>
                  Namespace <code>{proof.namespace}</code>. Each receipt opens the stored, encrypted
                  blob on the Walrus Mainnet aggregator.
                </p>
              </div>
            </div>
            <div className="memory-records">
              {proof.memories.map((m) => (
                <article key={m.id} className={m.supersededBy ? 'superseded' : ''}>
                  <span className="record-icon">
                    <Brain size={17} />
                  </span>
                  <div>
                    <div className="inline-labels">
                      <span className="eyebrow">
                        {m.kind}
                        {m.purpose ? ` · ${m.purpose}` : ''}
                      </span>
                      <span className="status-badge">
                        {m.supersededBy ? `Superseded by ${m.supersededBy}` : m.state}
                      </span>
                    </div>
                    <p>{m.text}</p>
                    <small>
                      {day(m.occurredAt)} · {name(m.supplierId)} · {m.id}
                    </small>
                    {m.blobId && (
                      <a
                        className="source-link"
                        href={aggregator + m.blobId}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Walrus blob {short(m.blobId)} <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
          <section className="records-section" aria-labelledby="payment-heading">
            <div className="section-heading">
              <div>
                <h2 id="payment-heading">Payment evidence through Tatum</h2>
                <p>
                  A read-only Sui Mainnet lookup through Tatum, matched against an independently
                  known invoice. A payment never proves delivery.
                </p>
              </div>
            </div>
            <PaymentResult payment={proof.payment} />
          </section>
        </>
      )}
      <footer className="workspace-footer">
        <span>
          <span className="tiny-dot" />
          Read-only · rate-limited · no sign-in needed
        </span>
        <span>Built to remember.</span>
      </footer>
    </main>
  );
}

function DecisionCard({
  decision: d,
  name,
}: {
  decision: LiveDecision;
  name: (id: string | null) => string;
}) {
  const top = d.rankedSupplierIds[0] ?? null;
  return (
    <article
      className="proof-card"
      data-testid={`decision-${d.usesMemory ? d.purpose : 'quotes-only'}`}
    >
      <span className="eyebrow">{d.label}</span>
      <h3 className="proof-top">{top ? name(top) : 'No eligible supplier'}</h3>
      <div className="inline-labels">
        <span className="status-badge">
          {d.status === 'ready' ? 'Ready' : d.status === 'provisional' ? 'Provisional' : 'Blocked'}
        </span>
        {d.usesMemory && (
          <span
            className={`history-pill ${d.memoryStatus === 'complete' ? 'positive' : 'warning'}`}
          >
            {d.memoryStatus === 'complete' ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}{' '}
            Recall {d.memoryStatus} · {d.recalledMemoryIds.length} memories
          </span>
        )}
      </div>
      <ul className="proof-reasons">
        {d.reasons.map((r, i) => (
          <li key={i}>
            {r.text}
            {r.memoryIds.length > 0 && <small>Memory: {r.memoryIds.join(', ')}</small>}
          </li>
        ))}
      </ul>
    </article>
  );
}

function PaymentResult({ payment: p }: { payment: LivePayment }) {
  if (p.state === 'not_configured')
    return (
      <p className="notice">
        A sample Sui transfer has not been configured yet, so no payment is checked.
      </p>
    );
  if (p.state === 'invalid_configuration') return <p className="form-error">{p.reason}</p>;
  const tx = (
    <a
      className="source-link"
      href={`https://suiscan.xyz/mainnet/tx/${p.digest}`}
      target="_blank"
      rel="noreferrer"
    >
      Transaction {short(p.digest)} <ExternalLink size={12} />
    </a>
  );
  if (p.state === 'lookup_failed')
    return (
      <div className="inset">
        {tx}
        <p className="form-error">{p.reason}</p>
      </div>
    );
  return (
    <div className="proof-grid two">
      <article className="proof-card" data-testid="payment-match">
        <span className="eyebrow">Expected invoice</span>
        <h3 className="proof-top">{sui(p.invoice.amountAtomic)}</h3>
        <p className="muted">
          {short(p.invoice.sender)} → {short(p.invoice.recipient)}
        </p>
        {tx}
        <p className={p.match.verified ? 'notice' : 'form-error'}>
          {p.match.verified ? (
            <>
              <ShieldCheck size={14} /> Payment verified.{' '}
            </>
          ) : (
            'Payment unverified. '
          )}
          {p.match.reason}
        </p>
      </article>
      <article className="proof-card" data-testid="payment-mismatch">
        <span className="eyebrow">Deliberate mismatch</span>
        <h3 className="proof-top">{sui(p.mismatch.amountAtomic)}</h3>
        <p className="muted">The same transaction, with the expected amount changed by one MIST.</p>
        <p className={p.mismatch.verified ? 'form-error' : 'notice'}>
          {p.mismatch.verified ? 'Unexpectedly matched. ' : 'Correctly rejected: '}
          {p.mismatch.reason}
        </p>
      </article>
    </div>
  );
}
