import type { RecordAdminAuditInput } from "./adminAudit.js";

export type AdminAuditOutboxStatus = "pending" | "processing" | "retry" | "sent" | "failed";

export type EnqueueAdminAuditInput = RecordAdminAuditInput & {
  maxAttempts?: number;
  nextAttemptAt?: Date;
};

export type AdminAuditOutboxRow = {
  id: string;
  action: string;
  payload: unknown;
  attemptCount: number;
  maxAttempts: number;
};

export type AdminAuditOutboxRowState = {
  id: string;
  status: AdminAuditOutboxStatus;
  attemptCount: number;
};

export type ProcessAdminAuditOutboxBatchOptions = {
  batchSize?: number;
  now?: Date;
  baseDelaySeconds?: number;
  maxDelaySeconds?: number;
};

export type ProcessAdminAuditOutboxBatchResult = {
  claimed: number;
  sent: number;
  retried: number;
  failed: number;
};
