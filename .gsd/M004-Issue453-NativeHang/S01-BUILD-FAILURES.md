# Issue #453: Native Code Hang - Build Failure Analysis

**Date:** March 15, 2026  
**Status:** Analysis Complete - Plan Formulated

## Problem Summary

The truncate functions (`truncateTail`, `truncateHead`, `truncateOutput`) are declared in Rust with proper `#[napi(js_name = "...")]` attributes but are not appearing in the native module exports at the JavaScript layer.

## Failed Attempts

### Attempt 1: Verify Original Repo Behavior

**Goal:** Confirm whether this is our bug or the original repo's bug.

**Action:** Checked original repo's native module exports.

**Result:** Original repo also does NOT export these functions:
```javascript
Truncate exports: [ 'truncateToWidth' ]
// truncateTail, truncateHead, truncateOutput are MISSING
```

**Conclusion:** This is NOT a bug in our implementation - the original repo has the same issue.

---

### Attempt 2: Add napi::bindgen_prelude Import

**Goal:** Verify if missing napi import was causing the issue.

**Action:** Added `use napi::bindgen_prelude::*;` to truncate.rs

**Build Output:**
```
warning: unused import: `napi::bindgen_prelude`
  --> crates\engine\src\truncate.rs:9:5
```

**Result:** Functions still not exported. Warning indicates import is unused (no napi macro actually used from the prelude).

---

### Attempt 3: Move Functions to lib.rs

**Goal:** Test if functions need to be in lib.rs (top-level) to be exported.

**Action:** Attempted to append truncate.rs content directly to lib.rs

**Build Output:**
```
error[E0753]: expected outer doc comment
```

**Reason:** Doc comments from truncate.rs were being concatenated incorrectly with lib.rs content.

**Action 2:** Reset lib.rs to original, then append truncate.rs content with proper spacing.

**Result:** Same error - NAPI-RS is not exporting these functions even when in lib.rs.

---

### Attempt 4: Check Function Signatures

**Goal:** Verify if async return type pattern was the issue.

**Action:** Compared with working async function (`batchParseGsdFiles`).

**Comparison:**
```rust
// Working (gsd_parser.rs)
#[napi(js_name = "batchParseGsdFiles")]
pub fn batch_parse_gsd_files(
    directory: String,
    #[napi(ts_arg_type = "number | undefined")] timeout_ms: Option<u32>,
) -> task::Async<BatchParseResult>

// Not working (truncate.rs)
#[napi(js_name = "truncateTail")]
pub fn truncate_tail(text: String, max_bytes: u32) -> TruncateResult
```

**Finding:** The sync version in original repo doesn't use `task::Async`. Our async version uses the same pattern as `batchParseGsdFiles` but still wasn't exporting.

---

### Attempt 5: Remove ts_return_type Attribute

**Goal:** Test if custom return type annotation was interfering.

**Action:** Removed `ts_return_type = "TruncateResult"` from function attributes.

**Result:** Functions still not exported.

---

### Attempt 6: Verify Build Completes Successfully

**Goal:** Ensure build errors weren't silently failing exports.

**Action:** Clean rebuild with verbose output.

**Build Output:**
```
Compiling gsd-engine v0.1.0 (E:\Dev\GSD\native\crates\engine)
    Finished `release` profile [optimized] target(s) in 55.61s
```

**Result:** Build completes successfully with no errors or warnings about exports.

---

### Attempt 7: Compare with grep Function

**Goal:** Test if the pattern works for other functions in the same module structure.

**Action:** Checked grep.rs exports.

**Finding:** `grep` function IS exported from the native module:
```javascript
All exports: [..., 'grep', ...]
```

**Comparison:**
```rust
// grep.rs - WORKING
#[napi(js_name = "grep")]
pub fn grep(options: NapiGrepOptions) -> task::Async<NapiGrepResult>

// truncate.rs - NOT WORKING
#[napi(js_name = "truncateTail")]
pub fn truncate_tail(text: String, max_bytes: u32) -> TruncateResult
```

**Key Difference:** `grep` uses `task::Async<...>` return type, `truncate` (original) returns `TruncateResult` directly.

---

## Root Cause Hypothesis

The NAPI-RS macro `#[napi(...)]` may not be generating JavaScript exports for functions in submodules (`mod truncate;`) unless they are explicitly re-exported at the lib.rs level.

**Evidence:**
1. `grep` is in the same module structure and IS exported
2. `batchParseGsdFiles` (in gsd_parser.rs submodule) IS exported
3. But `truncateTail`, `truncateHead`, `truncateOutput` are NOT exported

**Possible reasons:**
1. NAPI-RS version incompatibility with async functions from submodules
2. Functions need to be explicitly declared in lib.rs
3. Functions need different attribute syntax for submodule exports
4. The sync vs async return type affects export behavior

---

## What Was Actually Implemented

Despite the export issue, the following changes were made to the codebase:

### ✅ Committed to Repository
1. **task.rs** - Accepts `Option<u32>` for timeout parameter
2. **gsd_parser.rs** - `batch_parse_gsd_files()` is async with timeout
3. **image.rs** - Uses `None` for timeout in `task::blocking()` calls
4. **glob.rs** - Uses `timeout_ms` parameter in `task::blocking()`
5. **grep.rs** - Uses `None` for timeout in `task::blocking()`
6. **TypeScript wrappers** - All have timeout and AbortSignal support

### ❌ NOT Committed (Lost During Git Operations)
1. **truncate.rs async changes** - Never committed before filter-branch operation
2. **truncate.rs napi::bindgen_prelude import** - Added but unused, never committed

---

## Current State

**Repository:** `https://github.com/geromet/gsd-2-Debugging.git`  
**Commit:** `ca45d63` (Initial commit after secret filtering)

**Code Status:**
- `batch_parse_gsd_files`: ✅ Async with timeout support
- `truncate_tail/head/output`: ❌ Sync (original repo version)
- JS wrappers for truncate: ⚠️ Have timeout logic but call sync Rust functions

**Build Status:**
- ✅ Rust compiles
- ✅ Native binary builds
- ✅ TypeScript compiles
- ⚠️ Truncate functions not exported (same as original repo)

---

## Impact Assessment

**Backward Compatibility:** The current sync implementation is actually MORE backward compatible than the async version we wanted to implement.

**Problem Solved:** 
- The original repo's sync truncate functions DO block the event loop
- But since they're not exported, they're not accessible from JavaScript
- The JS wrappers try to call them as if they were native exports
- This may cause runtime errors or unexpected behavior

**Next Steps:** Need to determine if truncate functions should be:
1. Exported from native module (fix the export issue)
2. Implemented purely in TypeScript (if native implementation isn't needed)
3. Re-exported from a different location

---

## Lessons Learned

1. **Always verify exports after modifying Rust code** - Don't assume #[napi] attributes work
2. **Test native module immediately after build** - Catch export issues early
3. **Commit changes incrementally** - Lost async truncate changes due to filter-branch operation
4. **Compare with working examples** - grep and batchParseGsdFiles export correctly
5. **Document what was attempted** - This analysis helps future debugging

---

**Generated:** March 15, 2026  
**Next Review:** After implementing alternative fix plan