export type OutboxStatus = "pending" | "processing" | "retry" | "delivery_unknown" | "sent" | "failed";

export type NotificationEmailPayload = {
  to: string[];
  subject: string;
  text: string;
  replyTo?: string;
};

export type EnqueueNotificationEmailInput = {
  action: string;
  eventId?: string;
  payload: NotificationEmailPayload;
  maxAttempts?: number;
  nextAttemptAt?: Date;
};

export type NotificationOutboxRow = {
  id: string;
  eventId: string;
  action: string;
  payload: unknown;
  attemptCount: number;
  maxAttempts: number;
};

export type OutboxRowState = {
  id: string;
  status: OutboxStatus;
  attemptCount: number;
};

export type ProcessNotificationEmailOutboxBatchOptions = {
  batchSize?: number;
  now?: Date;
  baseDelaySeconds?: number;
  maxDelaySeconds?: number;
  deliver?: (payload: NotificationEmailPayload, eventId: string) => Promise<void>;
  force?: boolean;
};

export type ProcessNotificationEmailOutboxBatchResult = {
  claimed: number;
  sent: number;
  retried: number;
  failed: number;
};
