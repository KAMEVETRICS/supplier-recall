export type Purpose = 'launch' | 'restock';
export type Context = { storeId: string; now: string };
export interface Brief {
  id: string;
  title: string;
  specification: string;
  quantity: number;
  destination: string;
  budgetCents: number;
  neededBy: string;
  purpose: Purpose;
}
export interface Supplier {
  id: string;
  name: string;
  domain: string | null;
  identityConfirmed: boolean;
  fictional: boolean;
  location: string;
}
export interface Evidence {
  id: string;
  supplierId: string;
  kind: 'web_claim' | 'quote' | 'user_report' | 'outcome';
  source: string;
  retrievedAt: string;
  excerpt: string;
  fictional: boolean;
}
export interface Quote {
  id: string;
  supplierId: string;
  briefId: string;
  specification: string;
  quantity: number;
  currency: string;
  unitPriceCents: number | null;
  shippingCents: number | null;
  taxCents: number | null;
  minimumOrder: number | null;
  quotedAt: string | null;
  productionDays: number | null;
  transitDays: number | null;
  deliveryDaysKind: 'calendar' | 'business' | 'unknown';
  expiry: string | null;
  paymentTerms: string;
  evidenceIds: string[];
  confirmedAt: string | null;
}
export type QuoteDraft = Quote;
export type MemoryKind = 'research' | 'preference' | 'commitment' | 'decision' | 'outcome';
export interface MemoryRecord {
  id: string;
  storeId: string;
  supplierId: string | null;
  kind: MemoryKind;
  purpose: Purpose | null;
  text: string;
  occurredAt: string;
  evidenceIds: string[];
  supersedesId: string | null;
  facts?: {
    priority?: 'price' | 'reliability';
    promisedDays?: number;
    actualDays?: number;
    qualityIssue?: boolean;
    resolved?: boolean;
  };
}
export interface MemoryWrite {
  recordId: string;
  operationKey: string;
  jobId: string | null;
  state: 'pending' | 'accepted' | 'saved' | 'failed';
  receipt: Record<string, unknown> | null;
  errorCode: string | null;
}
export interface RecallResult {
  memories: MemoryRecord[];
  status: 'complete' | 'partial' | 'unavailable';
  missingActiveIds: string[];
}
export interface Reason {
  text: string;
  evidenceIds: string[];
  memoryIds: string[];
}
export interface CandidateResult {
  supplierId: string;
  totalCents: number | null;
  arrival: string | null;
  lateCount: number;
  observationCount: number;
  reasons: Reason[];
  questions: string[];
  eligible: boolean;
}
export interface Comparison {
  briefId: string;
  status: 'ready' | 'provisional' | 'blocked';
  rankedSupplierIds: string[];
  excluded: { supplierId: string; reasons: string[] }[];
  candidates: CandidateResult[];
  reasons: Reason[];
  questions: string[];
  recalledMemoryIds: string[];
  memoryStatus: RecallResult['status'];
}
export interface OrderEvent {
  id: string;
  briefId: string;
  supplierId: string;
  kind: 'decision' | 'commitment' | 'delivery' | 'quality' | 'correction';
  occurredAt: string;
  text: string;
  purpose?: Purpose;
  supersedesId?: string;
  priority?: 'price' | 'reliability';
  promisedDays?: number;
  actualDays?: number;
  evidenceIds: string[];
}
export interface Invoice {
  id: string;
  supplierId: string;
  expectedSender: string;
  expectedRecipient: string;
  assetType: string;
  amountAtomic: string;
}
export interface PaymentCheck {
  status: 'verified' | 'unverified';
  reason: string;
  digest: string;
  checkedAt: string;
  invoiceId: string;
}
export interface WorkspaceSnapshot {
  briefs: Brief[];
  suppliers: Supplier[];
  evidence: Evidence[];
  quotes: Quote[];
  memories: MemoryRecord[];
  memoryWrites: MemoryWrite[];
  orderEvents: OrderEvent[];
  invoices: Invoice[];
  paymentChecks: PaymentCheck[];
}
export interface DraftInput {
  comparison: Comparison;
  supplierName: string;
  commitments: string[];
}
export interface CitedDraft {
  text: string;
  evidenceIds: string[];
  memoryIds: string[];
}
