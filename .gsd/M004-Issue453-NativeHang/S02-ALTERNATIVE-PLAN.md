# Issue #453: Native Code Hang - Alternative Build Plan

**Date:** March 15, 2026  
**Status:** Plan Formulated

## Objective

Get truncate functions (`truncateTail`, `truncateHead`, `truncateOutput`) properly exported from the native module while implementing async timeout support.

---

## Analysis Summary

**Root Cause:** NAPI-RS `#[napi(...)]` attributes on functions in submodules (`mod truncate;`) are not generating JavaScript exports.

**Confirmed Facts:**
1. Original repo has the same export issue
2. Other functions from submodules (`grep`, `batchParseGsdFiles`) ARE exported correctly
3. Build completes successfully with no errors
4. Functions are properly annotated with `#[napi(js_name = "...")]`

---

## Alternative Methods (Ranked by Likelihood of Success)

### Method 1: Explicit Module Re-exports in lib.rs

**Concept:** NAPI-RS may require explicit re-export of submodule functions at the lib.rs level.

**Implementation:**
```rust
// lib.rs
pub mod truncate;

// Add explicit re-exports
pub use truncate::{truncate_tail, truncate_head, truncate_output, TruncateResult, TruncateOutputResult};

// Or use napi::prelude::napi to register them
#[napi]
pub use crate::truncate::{truncate_tail, truncate_head, truncate_output};
```

**Pros:**
- Minimal changes to existing code
- Follows Rust module system patterns
- NAPI-RS documentation mentions this pattern for complex exports

**Cons:**
- May still not work if NAPI-RS doesn't support this pattern
- Requires understanding NAPI-RS export mechanics

**Risk Level:** Low

---

### Method 2: Use `#[napi]` on Module Level

**Concept:** Some NAPI bindings require module-level registration.

**Implementation:**
```rust
// lib.rs
#[napi]
pub mod truncate {
    pub use crate::truncate::{truncate_tail, truncate_head, truncate_output};
}
```

**Pros:**
- Matches NAPI-RS module pattern
- Clean separation of concerns

**Cons:**
- May conflict with existing module structure
- Requires rewriting module organization

**Risk Level:** Medium

---

### Method 3: Implement Functions Directly in lib.rs

**Concept:** Move truncate functions from submodule to lib.rs where they're guaranteed to be exported.

**Implementation:**
```rust
// lib.rs
#[napi(object)]
pub struct TruncateResult { ... }

#[napi(object)]
pub struct TruncateOutputResult { ... }

#[napi(js_name = "truncateTail")]
pub fn truncate_tail(...) -> task::Async<TruncateResult> { ... }

#[napi(js_name = "truncateHead")]
pub fn truncate_head(...) -> task::Async<TruncateResult> { ... }

#[napi(js_name = "truncateOutput")]
pub fn truncate_output(...) -> task::Async<TruncateOutputResult> { ... }

// Keep truncate.rs for helper functions only
mod truncate_utils; // Contains count_lines, find_last_newline_before, etc.
```

**Pros:**
- Guaranteed to work (functions in lib.rs are always exported)
- Clean separation of exported API vs implementation details
- Follows pattern used by other NAPI-RS projects

**Cons:**
- More refactoring required
- Duplicate code if not careful (need to move helper functions)
- Breaking change to module structure

**Risk Level:** Medium-High

---

### Method 4: Use NAPI-RS `#[napi(js_name = "...", catch_unwind)]` Pattern

**Concept:** Try different attribute combinations to trigger export.

**Implementation:**
```rust
// Try adding catch_unwind attribute
#[napi(js_name = "truncateTail", catch_unwind)]
pub fn truncate_tail(...) -> TruncateResult { ... }

// Or try without js_name (use Rust name)
#[napi]
pub fn truncate_tail(text: String, max_bytes: u32) -> TruncateResult { ... }
```

**Pros:**
- Minimal code changes
- Quick to test

**Cons:**
- Likely won't work if the issue is submodule-related
- May introduce runtime behavior changes (catch_unwind)

**Risk Level:** Low

---

### Method 5: Implement Truncate in TypeScript/JavaScript Only

**Concept:** If native implementation isn't strictly necessary, implement truncate logic in TypeScript.

**Implementation:**
```typescript
// packages/native/src/truncate/index.ts
export function truncateTail(text: string, maxBytes: number): TruncateResult {
    const max = maxBytes as number;
    const totalBytes = text.length;
    
    if (totalBytes <= max) {
        const lineCount = text.split('\n').length;
        return { text, truncated: false, original_lines: lineCount, kept_lines: lineCount };
    }
    
    // Find last newline at or before maxBytes
    let cut = max;
    while (cut > 0 && text.charCodeAt(cut) !== 10) {
        cut--;
    }
    
    const kept = text.substring(0, cut);
    const keptLines = kept.split('\n').length;
    const originalLines = text.split('\n').length;
    
    return { 
        text: kept, 
        truncated: true, 
        original_lines: originalLines, 
        kept_lines: keptLines 
    };
}
```

**Pros:**
- No native code needed
- Easier to debug and maintain
- Immediate solution (no build issues)
- Still supports async wrapper with timeout

**Cons:**
- Slower than native implementation (pure JS vs Rust)
- Need to verify performance is acceptable
- Doesn't solve the original "hang" problem if native functions hang

**Risk Level:** Low (but may have performance implications)

---

### Method 6: Use NAPI-RS 3.x (Upgrade)

**Concept:** The issue may be a bug in NAPI-RS 2.x that was fixed in 3.x.

**Implementation:**
```toml
# Cargo.toml
napi = { version = "3", features = ["napi8"] }
napi-derive = "3"
```

**Pros:**
- May fix export issues automatically
- Access to latest NAPI-RS features

**Cons:**
- Breaking changes in API
- Requires significant migration effort
- May introduce new bugs

**Risk Level:** High

---

### Method 7: Debug with NAPI-RS Trace

**Concept:** Use NAPI-RS debug tools to understand why exports aren't generated.

**Implementation:**
```bash
# Enable NAPI-RS debug logging
RUST_LOG=napi=debug cargo build --release
```

**Pros:**
- Gives definitive answer about what's happening
- May reveal specific error or warning

**Cons:**
- May not provide actionable information
- NAPI-RS may not have detailed logging for this case

**Risk Level:** Low

---

## Recommended Approach

**Primary Strategy:** Method 1 (Explicit Module Re-exports)

**Rationale:**
1. Lowest risk - minimal code changes
2. Follows Rust best practices
3. Quick to implement and test
4. If it doesn't work, we have a clear fallback

**Fallback Strategy:** Method 3 (Move to lib.rs)

**Rationale:**
1. Guaranteed to work
2. Clean separation of concerns
3. Well-understood pattern

**Emergency Fallback:** Method 5 (Pure TypeScript)

**Rationale:**
1. Immediate solution if native exports can't be fixed
2. Allows progress on Issue #453 without being blocked
3. Can optimize to native later if performance is an issue

---

## Implementation Plan

### Phase 1: Quick Test (Method 1)
- [ ] Add explicit re-exports in lib.rs
- [ ] Build and test
- [ ] If works: ✅ Complete
- [ ] If fails: → Phase 2

### Phase 2: Refactor to lib.rs (Method 3)
- [ ] Move truncate structs and functions to lib.rs
- [ ] Keep helper functions in separate module
- [ ] Update async wrapper to use timeout
- [ ] Build and test
- [ ] If works: ✅ Complete
- [ ] If fails: → Phase 3

### Phase 3: Pure TypeScript (Method 5)
- [ ] Implement truncate logic in TypeScript
- [ ] Verify performance is acceptable
- [ ] Test with timeout wrapper
- [ ] Document native implementation as future optimization
- [ ] Complete Issue #453

---

## Success Criteria

1. **Export Verification:**
   ```javascript
   const { truncateTail, truncateHead, truncateOutput } = require('...');
   // All three functions should be defined
   ```

2. **Timeout Functionality:**
   - Operations exceeding timeout throw error
   - AbortSignal cancels operation
   - Warning logs for slow operations

3. **Backward Compatibility:**
   - Existing code continues to work
   - API signature unchanged (except async)

4. **Performance:**
   - Truncate operations complete within expected time
   - No significant regression vs original sync version

---

## Risk Mitigation

**Risk:** Method 1 fails, Method 3 is too invasive.

**Mitigation:** Have Method 5 ready as emergency fallback.

**Risk:** TypeScript implementation is too slow.

**Mitigation:** Profile performance first. If slow, can always add native implementation later with Method 3.

**Risk:** Breaking changes in NAPI-RS 3.x.

**Mitigation:** Only upgrade if other methods fail. Document all changes needed.

---

## Timeline Estimate

| Phase | Effort | Description |
|-------|--------|-------------|
| Method 1 | 30 min | Add re-exports, build, test |
| Method 3 | 2-3 hours | Refactor to lib.rs, add async, test |
| Method 5 | 1-2 hours | TypeScript implementation, test |

**Total (if all phases needed):** ~4-5 hours  
**Expected (Method 1 works):** ~30 minutes

---

## Notes

1. **Never remove our changes:** This plan assumes we want to keep the async timeout implementation, not revert to sync.

2. **Export issue is separate from hang fix:** The export problem prevents testing, but the async implementation in gsd_parser.rs is already correct.

3. **Original repo has same bug:** This isn't a regression - the original repo also doesn't export truncate functions.

4. **JS wrappers expect native exports:** The TypeScript code in `packages/native/src/truncate/index.ts` expects to call native functions. If native exports fail, we need to either fix exports or implement in JS.

---

**Generated:** March 15, 2026  
**Next Action:** Implement Method 1 (Explicit Module Re-exports)