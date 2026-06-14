/**
 * Promise timeout helper for sync operations.
 *
 * The Firestore SDK never rejects writes on network failure — it buffers them
 * and retries the transport forever — so awaiting setDoc() against an
 * unreachable server hangs indefinitely. Racing a timeout is the only way to
 * surface "server unreachable" as a failure (audit §4.3).
 */

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new TimeoutError(`${label} timed out after ${ms}ms (server unreachable?)`)),
      ms
    );
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}
