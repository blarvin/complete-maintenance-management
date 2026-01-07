export type StorageErrorCode =
  | "not-found"
  | "validation"
  | "conflict"
  | "unauthorized"
  | "unavailable"
  | "internal";

export type StorageError = Error & {
  code: StorageErrorCode;
  retryable: boolean;
  details?: Record<string, unknown>;
  cause?: unknown;
};

export function makeStorageError(
  code: StorageErrorCode,
  message: string,
  options?: { retryable?: boolean; details?: Record<string, unknown>; cause?: unknown }
): StorageError {
  const err = new Error(message) as StorageError;
  err.code = code;
  err.retryable = options?.retryable ?? code === "unavailable";
  err.details = options?.details;
  err.cause = options?.cause;
  return err;
}

export function isStorageError(err: unknown): err is StorageError {
  return Boolean(
    err &&
    typeof err === "object" &&
    "code" in err &&
    "retryable" in err &&
    typeof (err as StorageError).code === "string"
  );
}

export function toStorageError(
  err: unknown,
  fallback: { code?: StorageErrorCode; message?: string; retryable?: boolean } = {}
): StorageError {
  if (isStorageError(err)) return err;
  const code = fallback.code ?? "internal";
  const message =
    fallback.message ??
    (err instanceof Error ? err.message : "Unexpected storage error");
  const retryable =
    fallback.retryable ?? (code === "unavailable" || code === "internal");
  const wrapped = makeStorageError(code, message, { retryable, cause: err });
  return wrapped;
}

export function describeForUser(err: StorageError): string {
  switch (err.code) {
    case "not-found":
      return "That item was not found. It may have been removed.";
    case "validation":
      return "Please check the inputs and try again.";
    case "conflict":
      return "This item was updated elsewhere. Please refresh.";
    case "unauthorized":
      return "You do not have permission to do that.";
    case "unavailable":
      return "Service is temporarily unavailable. Please retry.";
    default:
      return "Something went wrong. Please try again.";
  }
}
