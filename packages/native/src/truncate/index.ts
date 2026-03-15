/**
 * Line-boundary-aware output truncation (native Rust).
 *
 * Truncates tool output at line boundaries, counting by UTF-8 bytes.
 * Three modes: head (keep end), tail (keep start), both (keep start+end).
 */

import { native } from "../native.js";

export interface TruncateResult {
  text: string;
  truncated: boolean;
  originalLines: number;
  keptLines: number;
}

export interface TruncateOutputResult {
  text: string;
  truncated: boolean;
  message?: string;
}

/**
 * Keep the first `maxBytes` worth of complete lines.
 */
export async function truncateTail(
  text: string,
  maxBytes: number,
  options: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<TruncateResult> {
  const { timeoutMs = 5000, signal } = options;

  if (signal?.aborted) {
    throw new Error("truncateTail aborted before starting");
  }

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(
      () => reject(new Error(`truncateTail timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
  });

  const abortReject = () => {
    throw new Error("truncateTail aborted");
  };
  const abortHandler = () => {
    abortReject();
  };
  signal?.addEventListener("abort", abortHandler, { once: true });

  try {
    const start = performance.now();
    const result = await Promise.race([
      (native as Record<string, Function>).truncateTail(text, maxBytes, timeoutMs),
      timeoutPromise,
    ]);
    const duration = performance.now() - start;
    if (duration > 1000) {
      console.warn(
        `[truncate] truncateTail took ${duration.toFixed(2)}ms for ${text.length} bytes`,
      );
    }
    return result as TruncateResult;
  } finally {
    signal?.removeEventListener("abort", abortHandler);
  }
}

/**
 * Keep the last `maxBytes` worth of complete lines.
 */
export async function truncateHead(
  text: string,
  maxBytes: number,
  options: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<TruncateResult> {
  const { timeoutMs = 5000, signal } = options;

  if (signal?.aborted) {
    throw new Error("truncateHead aborted before starting");
  }

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(
      () => reject(new Error(`truncateHead timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
  });

  const abortReject = () => {
    throw new Error("truncateHead aborted");
  };
  const abortHandler = () => {
    abortReject();
  };
  signal?.addEventListener("abort", abortHandler, { once: true });

  try {
    const start = performance.now();
    const result = await Promise.race([
      (native as Record<string, Function>).truncateHead(text, maxBytes, timeoutMs),
      timeoutPromise,
    ]);
    const duration = performance.now() - start;
    if (duration > 1000) {
      console.warn(
        `[truncate] truncateHead took ${duration.toFixed(2)}ms for ${text.length} bytes`,
      );
    }
    return result as TruncateResult;
  } finally {
    signal?.removeEventListener("abort", abortHandler);
  }
}

/**
 * Main entry point: truncate tool output with head/tail/both modes.
 */
export async function truncateOutput(
  text: string,
  maxBytes: number,
  mode?: string,
  options: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<TruncateOutputResult> {
  const { timeoutMs = 5000, signal } = options;

  if (signal?.aborted) {
    throw new Error("truncateOutput aborted before starting");
  }

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(
      () => reject(new Error(`truncateOutput timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
  });

  const abortReject = () => {
    throw new Error("truncateOutput aborted");
  };
  const abortHandler = () => {
    abortReject();
  };
  signal?.addEventListener("abort", abortHandler, { once: true });

  try {
    const start = performance.now();
    const result = await Promise.race([
      (native as Record<string, Function>).truncateOutput(text, maxBytes, mode, timeoutMs),
      timeoutPromise,
    ]);
    const duration = performance.now() - start;
    if (duration > 1000) {
      console.warn(
        `[truncate] truncateOutput took ${duration.toFixed(2)}ms for ${text.length} bytes`,
      );
    }
    return result as TruncateOutputResult;
  } finally {
    signal?.removeEventListener("abort", abortHandler);
  }
}