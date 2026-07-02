import { retry } from "./retry";

type LazyRetryOptions = Parameters<typeof retry>[1];

export function lazyWithRetry<TModule>(
  importer: () => Promise<TModule>,
  options: LazyRetryOptions = {},
): () => Promise<TModule> {
  return () =>
    retry(importer, {
      maxRetries: 1,
      initialDelay: 150,
      maxDelay: 150,
      backoff: 1,
      ...options,
    });
}
