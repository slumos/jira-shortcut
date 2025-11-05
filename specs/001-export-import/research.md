# Research: Rule Export and Import

**Feature**: 001-export-import
**Date**: 2025-10-08
**Status**: Complete

## Purpose

Research technical approaches for implementing export/import functionality in a Chrome Manifest V3 extension, focusing on file operations, JSON schema design, validation strategies, and merge conflict resolution.

---

## Research Areas

### 1. File Export in Chrome Extensions (Manifest V3)

**Decision**: Use Blob + `URL.createObjectURL()` + temporary anchor element download

**Rationale**:
- Manifest V3 removed `chrome.downloads` permission requirement for blob downloads
- `URL.createObjectURL()` works without additional permissions
- Pattern: `const blob = new Blob([jsonString], {type: 'application/json'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);`
- Cross-browser compatible (Chrome, Edge, Brave)
- No new permissions needed

**Alternatives Considered**:
- **File System Access API**: Requires user gesture, shows directory picker (too intrusive for simple export)
- **chrome.downloads API**: Requires "downloads" permission (violates "no new permissions" constraint)
- **DataURL approach**: Works but less efficient for large files

**References**:
- MDN: Blob API, URL.createObjectURL()
- Chrome MV3 migration guide: File downloads without permissions

---

### 2. File Import in Chrome Extensions

**Decision**: Use HTML `<input type="file">` + FileReader API

**Rationale**:
- Standard HTML5 file picker (no permissions needed)
- FileReader API reads file content as text
- User-initiated action (security best practice)
- Pattern: `<input type="file" accept=".json" />` + `reader.readAsText(file)` + `JSON.parse()`
- Cross-browser compatible

**Alternatives Considered**:
- **File System Access API**: Better UX for power users but requires Chrome 86+, shows complex picker UI (overkill for single file import)
- **Drag & drop**: Additional complexity, not keyboard-accessible without significant work

**References**:
- MDN: FileReader API, HTMLInputElement file type

---

### 3. Export File Format

**Decision**: JSON with schema versioning

**Schema Structure**:
```json
{
  "formatVersion": "1.0",
  "exportedAt": "2025-10-08T12:34:56.789Z",
  "extensionVersion": "7.2.0",
  "rules": [
    {
      "id": "rule_1234567890",
      "name": "Email",
      "url_pattern": "(jira|tickets)*/browse/",
      "title_pattern": "^\\[#?([^\\]]+)\\](.*)( -[^-]+)$",
      "out_pattern": "$html:<a href=\"$url\">$1:$2</a>",
      "test_url": "https://issues.apache.org/jira/browse/HADOOP-3629",
      "test_title": "[HADOOP-3629] Document the metrics - JIRA"
    }
  ]
}
```

**Rationale**:
- JSON is human-readable, editable in text editors, and scriptable
- `formatVersion` enables future schema evolution
- `exportedAt` provides audit trail
- `extensionVersion` helps diagnose compatibility issues
- `rules` array preserves all RuleConfig fields
- Pretty-printed JSON (2-space indent) for readability

**File Naming**: `jira-shortcut-rules-YYYYMMDDHHmmss.json`
- Includes timestamp to prevent overwrites
- Descriptive name for shared files
- `.json` extension for editor syntax highlighting

**Alternatives Considered**:
- **YAML**: More human-friendly but requires parser library (adds complexity)
- **CSV**: Poor fit for nested data (regex patterns with commas)
- **Plain JS objects**: Would require eval() (security violation)

---

### 4. Import Validation Strategy

**Decision**: Multi-stage validation with specific error messages

**Validation Stages**:

1. **JSON Parse** (catch syntax errors)
   - Error: "Invalid JSON syntax at line X: [error message]"
   - Use try/catch on `JSON.parse()`

2. **Schema Validation** (check required fields)
   - Required top-level: `formatVersion`, `rules`
   - Required per rule: `name`, `url_pattern`, `title_pattern`, `out_pattern`
   - Optional per rule: `id`, `test_url`, `test_title`
   - Error: "Missing required field '[field]' in rule #[index]"

3. **Format Version Check**
   - Support: v1.0 only (for now)
   - Future versions: apply migrations if needed
   - Error: "Unsupported format version [version]. This extension supports v1.0"

4. **Field Type Validation**
   - `name`: non-empty string
   - Patterns: valid regex (test with `new RegExp()`)
   - Error: "Invalid regex in rule '[name]': [error message]"

5. **Optional Warnings** (non-blocking)
   - Unknown fields: Warn but ignore (forward compatibility)
   - Very large file: Warn if >1000 rules

**Rationale**:
- Early failures prevent partial imports
- Specific errors enable quick fixes (SC-006 requirement)
- Regex validation catches common user errors
- Forward compatibility via unknown field tolerance

**Error Display**: Alert dialog or styled error div in Options page

---

### 5. Merge Conflict Resolution

**Decision**: Automatic ID regeneration for imported rules

**Conflict Types**:

1. **ID Conflicts** (imported rule ID exists in storage)
   - Resolution: Generate new ID for imported rule (`rule_[Date.now()]_[randomSuffix]`)
   - Preserves both rules
   - User sees both in Options page

2. **Name Conflicts** (imported rule name matches existing)
   - Resolution: No automatic rename (names are not unique identifiers)
   - User can manually rename later
   - Document in quickstart: "Duplicate names are allowed"

**Rationale**:
- ID regeneration is transparent and safe
- Name conflicts are rare in practice (users typically share different rule sets)
- Automatic naming (e.g., "Email (imported)") adds complexity without clear value
- User has full control post-import via Options page

**Alternatives Considered**:
- **Prompt user for each conflict**: Too disruptive for batch imports
- **Skip duplicates**: User might not notice missing rules
- **Automatic naming**: Hard to predict good suffixes

---

### 6. Replace vs. Merge Implementation

**Decision**: Two-path import with confirmation dialog

**Replace Mode**:
- Clear all existing rules via `Config.remove_all()`
- Import all rules from file
- Confirmation: "Replace all existing rules? This cannot be undone. You have [N] rules configured."
- Cancel preserves current state

**Merge Mode**:
- Load existing rules from storage
- For each imported rule:
  - Check if ID exists
  - If exists: Generate new ID
  - Add to storage
- No confirmation needed (non-destructive)

**UI**: Radio buttons or dropdown in import dialog
```
Import Mode:
○ Replace existing rules (remove all current rules first)
○ Merge with existing rules (keep current rules, add imported)
```

**Rationale**:
- Replace mode needs confirmation (destructive operation)
- Merge mode is safe by default
- Clear UI prevents accidental data loss

---

### 7. Storage Quota Considerations

**Chrome Storage Sync Limits**:
- Total: 102,400 bytes (~100KB)
- Per-item: 8,192 bytes (~8KB)
- Max items: 512

**Implications**:
- Typical rule: ~400 bytes (with patterns and test data)
- Max rules (theoretical): ~250 rules
- Practical limit with metadata: ~200 rules

**Import Validation**:
- Calculate total size before import
- Error if exceeds quota: "Import would exceed storage quota ([size] bytes). Current usage: [used], Import size: [import], Limit: 102,400 bytes"
- Suggest: "Remove existing rules or reduce imported rules"

**Rationale**:
- Better to fail with clear message than corrupt storage
- Quota errors are rare (most users have <20 rules)
- If quota is a problem, users should use fewer rules (aligns with "Simplicity First")

**Alternatives Considered**:
- **chrome.storage.local**: No sync, defeats sharing use case
- **Compression**: Adds complexity, minimal benefit for small JSON files

---

### 8. File Operations Best Practices

**Export Best Practices**:
- Pretty-print JSON: `JSON.stringify(data, null, 2)`
- UTF-8 encoding: Default for Blob with text content
- Timestamp in filename: `new Date().toISOString().replace(/:/g, '-').split('.')[0]`
- Revoke object URL after download: `URL.revokeObjectURL(url)` (memory cleanup)

**Import Best Practices**:
- Limit file size check: Warn if >10MB (likely wrong file)
- Accept only `.json` files: `<input accept=".json">`
- Read as text: `FileReader.readAsText(file, 'UTF-8')`
- Trim content before parse: `JSON.parse(content.trim())` (handles trailing whitespace)

**Security**:
- No eval() or Function() constructor (Manifest V3 CSP violation)
- Validate all fields before storage write
- Don't trust file content (user could edit maliciously)

---

### 9. Testing Strategy

**Manual Test Cases** (per constitution: no automated tests currently):

**Export Tests**:
1. Export with 0 rules → file contains empty array
2. Export with 3 rules → file contains all fields
3. Open exported file in text editor → valid JSON, readable
4. Export, modify in editor, re-import → changes preserved

**Import Replace Tests**:
1. Import valid file with replace → old rules gone, new rules active
2. Import invalid JSON → error shown, no changes
3. Import with missing field → error shown, no changes
4. Import with future version → error shown

**Import Merge Tests**:
1. Import with merge → old + new rules present
2. Import with duplicate ID → new ID generated, both rules present
3. Import 50 rules via script → all rules functional

**Edge Cases**:
1. Import file with unicode characters (emojis, non-Latin) → preserved
2. Import very large file (1000 rules) → warning or quota error
3. Import then immediate export → round-trip lossless

**Cross-Browser**:
- Repeat key tests on Chrome, Edge, Brave

---

## Summary of Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Export method | Blob + createObjectURL | No permissions, MV3 compatible |
| Import method | File input + FileReader | Standard, no permissions |
| Format | JSON with versioning | Human-readable, editable, scriptable |
| Validation | Multi-stage with specific errors | Clear error messages (SC-006) |
| Merge conflicts | Auto-regenerate IDs | Transparent, preserves all rules |
| Replace confirmation | Required | Prevents accidental data loss |
| Storage limits | Validate before import | Clear error, prevent corruption |
| File naming | Timestamped | Prevents overwrites, audit trail |

---

## Open Questions Resolved

1. **Q**: Should we support bulk operations (export selected rules)?
   **A**: No - adds UI complexity. Export all, edit file, re-import (per spec requirement for text editing)

2. **Q**: Should merge mode show a diff preview?
   **A**: No - MVP scope creep. User can inspect Options page after import

3. **Q**: Should we validate regex patterns during import?
   **A**: Yes - prevents runtime errors (user story 4, scenario 3)

4. **Q**: Should export be triggered by keyboard shortcut?
   **A**: No - export/import are secondary configuration tasks, not primary workflows (Constitution IV)

---

## Implementation Notes for Planning

- New file: `jira/js/export-import.js` (encapsulates all file operations)
- Export function signature: `ExportImport.exportRules(rules) -> void` (triggers download)
- Import function signature: `ExportImport.importRules(file, mode) -> Promise<{success, errors, imported}>`
- Validation function: `ExportImport.validateRulesFile(data) -> {valid, errors}`
- Integration point: `options.js` calls export-import.js, uses Config for storage operations

---

**Research Status**: ✅ COMPLETE - Ready for Phase 1 Design
