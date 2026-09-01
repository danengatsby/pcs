export type ApiEnvelope<Data, Err = { code: string; message: string } | null> = {
  data: Data | null;
  error: Err;
  meta: {
    requestId: string;
    timestamp: string;
    [key: string]: unknown;
  };
};
