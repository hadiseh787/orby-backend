// Design contract only. Validate every boundary with runtime schemas.
export type AtomicAmount = string;
export type Book = 'TESTNET' | 'SIMULATION';
export type PriceMode = 'FIXTURE' | 'LIVE_REFERENCE';
export type ApprovalPolicy = 'MANUAL_APPROVAL' | 'AUTO_AFTER_CHECKS';
export type JobState = 'OPEN' | 'FUNDED' | 'RUNNING' | 'DELIVERED'
  | 'REVISION_REQUIRED' | 'REVIEW_OPEN' | 'DISPUTED'
  | 'SETTLED' | 'REFUNDED' | 'CANCELLED';
export type OperationState = 'PREPARED' | 'SUBMITTED' | 'CONFIRMED' | 'FAILED' | 'UNKNOWN';
export interface Amount { atomic: AtomicAmount; asset: 'testNEAR' | 'simNEAR'; book: Book; }
export interface PriceSnapshot {
  id: string; mode: PriceMode; source: string;
  priceMicroPerNear: AtomicAmount; publishTimeMs: string; observedAtMs: string;
}
export interface Criterion {
  id: string; type: 'AUTO_CHECK' | 'AI_REVIEW' | 'CLIENT_APPROVE';
  required: boolean; description: string;
  config?: {check: 'json-required-keys' | 'item-count' | 'word-count' | 'source-ids'; keys?: string[]; min?: number; max?: number};
}
export interface FundingPreview {
  previewId: string; jobId: string; bidId: string; network: 'testnet';
  book: 'TESTNET'; payloadHash: string; quote: PriceSnapshot;
  usdMicro: AtomicAmount; escrowYocto: AtomicAmount; estimatedFeeYocto: AtomicAmount;
  performanceBondYocto: AtomicAmount; feeBps: number; bufferBps: number;
  termsVersion: number; policyVersion: number; expiresAtMs: string;
  approvalPolicy: ApprovalPolicy; priceFallback: 'FUNDING_PRICE';
  disputeFallbackAwardBps: 5000;
}
export interface NearTransactionProposal {
  operationId: string; requestId: string; payloadHash: string;
  signerId: string; receiverId: string; network: 'testnet';
  methodName: string; args: Record<string, unknown>;
  attachedDepositYocto: AtomicAmount; gas: string;
}
export interface Settlement {
  jobId: string; escrow: Amount; awarded: Amount; platformFee: Amount;
  debtPaid: Amount; creatorCredit: Amount; refund: Amount;
  priceSnapshotId: string; shortfallCapped: boolean; fallbackUsed: boolean;
  receiptId: string; finality: 'FINAL';
}
export interface RuntimeAcceptance {runId: string; status: 'ACCEPTED'; protocolVersion: '1.0';}
export interface RuntimeStatus {
  runId: string; status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
  artifactHash?: string; error?: {code: string; message: string; retryable: boolean};
}
export interface ErrorEnvelope {
  code: string; message: string; requestId: string; retryable: boolean;
  details?: Record<string, unknown>;
}
