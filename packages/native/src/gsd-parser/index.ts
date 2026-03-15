/**
 * GSD file parser — native Rust implementation.
 *
 * Parses `.gsd/` directory markdown files containing YAML-like frontmatter
 * and structured sections. Replaces the JS regex-based parser for
 * performance-critical batch operations.
 */

import { native } from "../native.js";
import type {
  BatchParseResult,
  FrontmatterResult,
  NativeRoadmap,
  SectionResult,
} from "./types.js";

export type {
  BatchParseResult,
  FrontmatterResult,
  NativeBoundaryMapEntry,
  NativeRoadmap,
  NativeRoadmapSlice,
  ParsedGsdFile,
  SectionResult,
} from "./types.js";

/**
 * Parse YAML-like frontmatter from markdown content.
 *
 * Returns `{ metadata, body }` where `metadata` is a JSON string
 * of the parsed frontmatter key-value pairs. Parse it with `JSON.parse()`.
 */
export function parseFrontmatter(content: string): FrontmatterResult {
  const start = performance.now();
  const result = (native as Record<string, Function>).parseFrontmatter(
    content,
  ) as FrontmatterResult;
  const duration = performance.now() - start;
  if (duration > 100) {
    console.warn(
      `[gsd-parser] parseFrontmatter took ${duration.toFixed(2)}ms for ${content.length} bytes`,
    );
  }
  return result;
}

/**
 * Extract a section from markdown content by heading name.
 *
 * @param content  Markdown content to search.
 * @param heading  Heading text to match (without the `#` prefix).
 * @param level    Heading level (default 2 for `##`).
 */
export function extractSection(
  content: string,
  heading: string,
  level?: number,
): SectionResult {
  const start = performance.now();
  const result = (native as Record<string, Function>).extractSection(
    content,
    heading,
    level,
  ) as SectionResult;
  const duration = performance.now() - start;
  if (duration > 100) {
    console.warn(
      `[gsd-parser] extractSection took ${duration.toFixed(2)}ms for ${content.length} bytes`,
    );
  }
  return result;
}

/**
 * Extract all sections at a given heading level.
 *
 * Returns a JSON string mapping heading names to their content.
 * Parse with `JSON.parse()`.
 */
export function extractAllSections(
  content: string,
  level?: number,
): string {
  const start = performance.now();
  const result = (native as Record<string, Function>).extractAllSections(
    content,
    level,
  ) as string;
  const duration = performance.now() - start;
  if (duration > 100) {
    console.warn(
      `[gsd-parser] extractAllSections took ${duration.toFixed(2)}ms for ${content.length} bytes`,
    );
  }
  return result;
}

/**
 * Batch-parse all `.md` files in a `.gsd/` directory tree.
 *
 * Reads and parses all markdown files under the given directory.
 * Each file gets frontmatter parsing and section extraction.
 */
export async function batchParseGsdFiles(
  directory: string,
  options: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<BatchParseResult> {
  const { timeoutMs = 30000, signal } = options;

  if (signal?.aborted) {
    throw new Error("batchParseGsdFiles aborted before starting");
  }

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(
      () => reject(new Error(`batchParseGsdFiles timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
  });

  const reject = () => {
    throw new Error("batchParseGsdFiles aborted");
  };
  const abortHandler = () => {
    reject();
  };
  signal?.addEventListener("abort", abortHandler, { once: true });

  try {
    const start = performance.now();
    const result = await Promise.race([
      (native as Record<string, Function>).batchParseGsdFiles(
        directory,
        timeoutMs,
      ),
      timeoutPromise,
    ]);
    const duration = performance.now() - start;
    if (duration > 5000) {
      console.warn(
        `[gsd-parser] batchParseGsdFiles took ${duration.toFixed(2)}ms for ${directory}`,
      );
    }
    return result as BatchParseResult;
  } finally {
    signal?.removeEventListener("abort", abortHandler);
  }
}

/**
 * Parse a roadmap file's content into structured data.
 *
 * Extracts title, vision, success criteria, slices (with risk/depends),
 * and boundary map entries.
 */
export function parseRoadmapFile(content: string): NativeRoadmap {
  const start = performance.now();
  const result = (native as Record<string, Function>).parseRoadmapFile(
    content,
  ) as NativeRoadmap;
  const duration = performance.now() - start;
  if (duration > 1000) {
    console.warn(
      `[gsd-parser] parseRoadmapFile took ${duration.toFixed(2)}ms for ${content.length} bytes`,
    );
  }
  return result;
}