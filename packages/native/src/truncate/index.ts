/**
 * Line-boundary-aware output truncation (TypeScript implementation).
 *
 * Truncates tool output at line boundaries, counting by UTF-8 bytes.
 * Three modes: head (keep end), tail (keep start), both (keep start+end).
 */

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

function countLines(text: string): number {
  if (text.length === 0) return 0;
  const newlines = (text.match(/\n/g) || []).length;
  return text.endsWith('\n') ? newlines : newlines + 1;
}

function findLastNewlineBefore(text: string, limit: number): number {
  const bytes = new TextEncoder().encode(text);
  const searchEnd = Math.min(limit, bytes.length);
  for (let i = searchEnd - 1; i >= 0; i--) {
    if (bytes[i] === 0x0a) return i + 1;
  }
  return 0;
}

function findFirstNewlineAfter(text: string, pos: number): number {
  const bytes = new TextEncoder().encode(text);
  const start = Math.min(pos, bytes.length);
  for (let i = start; i < bytes.length; i++) {
    if (bytes[i] === 0x0a) return i + 1;
  }
  return bytes.length;
}

export function _truncateTailSync(text: string, maxBytes: number): TruncateResult {
  const max = maxBytes;
  const bytes = new TextEncoder().encode(text);
  const totalBytes = bytes.length;

  if (totalBytes <= max) {
    const lineCount = countLines(text);
    return { text, truncated: false, originalLines: lineCount, keptLines: lineCount };
  }

  const originalLines = countLines(text);
  const cut = findLastNewlineBefore(text, max);

  if (cut === 0) {
    return { text: "", truncated: true, originalLines, keptLines: 0 };
  }

  const keptBytes = bytes.slice(0, cut);
  const keptText = new TextDecoder().decode(keptBytes);
  const keptLines = countLines(keptText);

  return { text: keptText, truncated: true, originalLines, keptLines };
}

export function _truncateHeadSync(text: string, maxBytes: number): TruncateResult {
  const max = maxBytes;
  const bytes = new TextEncoder().encode(text);
  const totalBytes = bytes.length;

  if (totalBytes <= max) {
    const lineCount = countLines(text);
    return { text, truncated: false, originalLines: lineCount, keptLines: lineCount };
  }

  const originalLines = countLines(text);
  const skipTo = totalBytes - max;
  const start = findFirstNewlineAfter(text, skipTo);

  if (start >= totalBytes) {
    return { text: "", truncated: true, originalLines, keptLines: 0 };
  }

  const keptBytes = bytes.slice(start);
  const keptText = new TextDecoder().decode(keptBytes);
  const keptLines = countLines(keptText);

  return { text: keptText, truncated: true, originalLines, keptLines };
}

export function _truncateOutputSync(text: string, maxBytes: number, mode?: string): TruncateOutputResult {
  const max = maxBytes;

  if (text.length <= max) {
    return { text, truncated: false, message: undefined };
  }

  const modeStr = mode ?? "tail";
  const originalLines = countLines(text);

  switch (modeStr) {
    case "head": {
      const r = _truncateHeadSync(text, max);
      const removed = new TextEncoder().encode(text).length - new TextEncoder().encode(r.text).length;
      return {
        text: r.text,
        truncated: true,
        message: `Kept last ${r.keptLines} of ${r.originalLines} lines (${removed} bytes truncated from start)`,
      };
    }
    case "both": {
      const half = Math.floor(max / 2);
      const headResult = _truncateTailSync(text, half);
      const tailResult = _truncateHeadSync(text, max - half);
      const marker = `\n\n... [${originalLines - headResult.keptLines - tailResult.keptLines} lines elided] ...\n\n`;
      const combined = headResult.text + marker + tailResult.text;
      const kept = headResult.keptLines + tailResult.keptLines;
      return {
        text: combined,
        truncated: true,
        message: `Kept ${kept} of ${originalLines} lines (head ${headResult.keptLines} + tail ${tailResult.keptLines})`,
      };
    }
    default: {
      const r = _truncateTailSync(text, max);
      const removed = new TextEncoder().encode(text).length - new TextEncoder().encode(r.text).length;
      return {
        text: r.text,
        truncated: true,
        message: `Kept first ${r.keptLines} of ${r.originalLines} lines (${removed} bytes truncated from end)`,
      };
    }
  }
}

export async function truncateTail(
  text: string,
  maxBytes: number,
  options: { timeoutMs?: number; signal?: AbortSignal } = {}
): Promise<TruncateResult> {
  const { timeoutMs = 5000, signal } = options;

  if (signal?.aborted) {
    throw new Error("truncateTail aborted before starting");
  }

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`truncateTail timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  const abortReject = () => { throw new Error("truncateTail aborted"); };
  const abortHandler = () => { abortReject(); };
  signal?.addEventListener("abort", abortHandler, { once: true });

  try {
    const start = performance.now();
    const result = _truncateTailSync(text, maxBytes);
    const duration = performance.now() - start;
    if (duration > 1000) {
      console.warn(`[truncate] truncateTail took ${duration.toFixed(2)}ms for ${text.length} bytes`);
    }
    return result;
  } finally {
    signal?.removeEventListener("abort", abortHandler);
  }
}

export async function truncateHead(
  text: string,
  maxBytes: number,
  options: { timeoutMs?: number; signal?: AbortSignal } = {}
): Promise<TruncateResult> {
  const { timeoutMs = 5000, signal } = options;

  if (signal?.aborted) {
    throw new Error("truncateHead aborted before starting");
  }

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`truncateHead timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  const abortReject = () => { throw new Error("truncateHead aborted"); };
  const abortHandler = () => { abortReject(); };
  signal?.addEventListener("abort", abortHandler, { once: true });

  try {
    const start = performance.now();
    const result = _truncateHeadSync(text, maxBytes);
    const duration = performance.now() - start;
    if (duration > 1000) {
      console.warn(`[truncate] truncateHead took ${duration.toFixed(2)}ms for ${text.length} bytes`);
    }
    return result;
  } finally {
    signal?.removeEventListener("abort", abortHandler);
  }
}

export async function truncateOutput(
  text: string,
  maxBytes: number,
  mode?: string,
  options: { timeoutMs?: number; signal?: AbortSignal } = {}
): Promise<TruncateOutputResult> {
  const { timeoutMs = 5000, signal } = options;

  if (signal?.aborted) {
    throw new Error("truncateOutput aborted before starting");
  }

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`truncateOutput timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  const abortReject = () => { throw new Error("truncateOutput aborted"); };
  const abortHandler = () => { abortReject(); };
  signal?.addEventListener("abort", abortHandler, { once: true });

  try {
    const start = performance.now();
    const result = _truncateOutputSync(text, maxBytes, mode);
    const duration = performance.now() - start;
    if (duration > 1000) {
      console.warn(`[truncate] truncateOutput took ${duration.toFixed(2)}ms for ${text.length} bytes`);
    }
    return result;
  } finally {
    signal?.removeEventListener("abort", abortHandler);
  }
}