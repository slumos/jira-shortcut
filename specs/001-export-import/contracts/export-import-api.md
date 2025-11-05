# API Contract: Export/Import Module

**Feature**: 001-export-import
**Date**: 2025-10-08
**Module**: `jira/js/export-import.js`

## Overview

This document defines the public API for the ExportImport module. This module is a pure JavaScript utility - not a REST API or web service. It operates entirely in the browser extension context.

---

## Module: ExportImport

**Location**: `jira/js/export-import.js`
**Dependencies**: `config.js` (Config, RuleConfig), Chrome Extension APIs (chrome.runtime, chrome.storage)

### Public Methods

---

#### `exportRules()`

Exports all configured rules to a JSON file and triggers browser download.

**Signature**:
```javascript
ExportImport.exportRules() -> Promise<void>
```

**Parameters**: None

**Returns**: Promise that resolves when download is triggered, rejects on error

**Behavior**:
1. Calls `Config.get_all()` to retrieve all rules from chrome.storage.sync
2. Constructs ExportFile JSON object (see data-model.md)
3. Serializes to pretty-printed JSON string
4. Creates Blob with MIME type `application/json`
5. Generates filename: `jira-shortcut-rules-YYYY-MM-DD-HHmmss.json`
6. Triggers download via `URL.createObjectURL()` + anchor element
7. Cleans up object URL

**Errors**:
- Rejects with Error if storage read fails
- Rejects with Error if browser blocks download

**Example Usage**:
```javascript
document.getElementById('export-btn').addEventListener('click', async () => {
  try {
    await ExportImport.exportRules();
    console.log('Export successful');
  } catch (error) {
    alert(`Export failed: ${error.message}`);
  }
});
```

**Side Effects**:
- Downloads file to user's default download location
- No changes to extension storage

---

#### `importRules(file, mode)`

Imports rules from a JSON file with replace or merge mode.

**Signature**:
```javascript
ExportImport.importRules(file: File, mode: 'replace' | 'merge') -> Promise<ImportResult>
```

**Parameters**:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `file` | File | Yes | File object from `<input type="file">` element |
| `mode` | string | Yes | Import mode: "replace" or "merge" |

**Returns**: Promise<ImportResult>

**ImportResult Object**:
```typescript
{
  success: boolean,       // True if import completed
  importedCount: number,  // Number of rules imported
  errors: string[],       // Array of error messages (empty if success)
  warnings: string[]      // Non-blocking warnings (e.g., unknown fields)
}
```

**Behavior**:

**Common Steps (Both Modes)**:
1. Reads file content via FileReader.readAsText()
2. Validates file size (<10MB)
3. Parses JSON (catch syntax errors)
4. Validates schema via `validateExportFile()` (see below)
5. Checks storage quota availability

**Replace Mode**:
6. Calls `Config.remove_all()` to clear existing rules
7. Iterates imported rules, creates RuleConfig for each, calls `save()`
8. Returns ImportResult with count

**Merge Mode**:
6. Calls `Config.get_all()` to get existing rule IDs
7. For each imported rule:
   - If ID exists: Generate new ID (`rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)
   - Create RuleConfig with (new) ID
   - Call `save()`
8. Returns ImportResult with count

**Errors**:
- Returns `{success: false, errors: [...]}` if validation fails
- Returns `{success: false, errors: [...]}` if storage quota exceeded
- Returns `{success: false, errors: [...]}` if storage write fails

**Example Usage**:
```javascript
document.getElementById('import-btn').addEventListener('click', async () => {
  const fileInput = document.getElementById('file-input');
  const mode = document.querySelector('input[name="mode"]:checked').value;

  if (!fileInput.files[0]) {
    alert('Please select a file');
    return;
  }

  try {
    const result = await ExportImport.importRules(fileInput.files[0], mode);
    if (result.success) {
      alert(`Imported ${result.importedCount} rules`);
      location.reload(); // Refresh Options page
    } else {
      alert(`Import failed:\n${result.errors.join('\n')}`);
    }
  } catch (error) {
    alert(`Import error: ${error.message}`);
  }
});
```

**Side Effects**:
- Writes rules to chrome.storage.sync
- Replace mode: Deletes all existing rules
- Merge mode: Adds new rules, preserves existing

---

#### `validateExportFile(data)`

Validates export file schema and rule data. Internal utility, exposed for testing.

**Signature**:
```javascript
ExportImport.validateExportFile(data: object) -> ValidationResult
```

**Parameters**:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `data` | object | Yes | Parsed JSON object from import file |

**Returns**: ValidationResult

**ValidationResult Object**:
```typescript
{
  valid: boolean,         // True if file is valid
  errors: string[],       // Validation errors (empty if valid)
  warnings: string[]      // Non-critical warnings
}
```

**Validation Checks**:
1. **Required top-level fields**: `formatVersion`, `rules`
2. **Format version**: Must be "1.0"
3. **Rules array**: Must be array (can be empty)
4. **Per-rule required fields**: `name`, `url_pattern`, `title_pattern`, `out_pattern`
5. **Field types**:
   - `name`: Non-empty string, max 100 chars
   - Patterns: Valid JavaScript regex (tested with `new RegExp()`)
6. **Unknown fields**: Warning only (forward compatibility)

**Error Messages** (examples):
- "Missing required field: formatVersion"
- "Unsupported format version: 2.0. Supported: 1.0"
- "rules must be an array"
- "Rule #2 missing required field: name"
- "Invalid regex in rule 'Email': Unterminated character class"

**Warning Messages** (examples):
- "Unknown field 'priority' will be ignored"
- "Rule #3 has no test data (test_url, test_title)"

**Example Usage**:
```javascript
const data = JSON.parse(fileContent);
const result = ExportImport.validateExportFile(data);

if (!result.valid) {
  console.error('Validation errors:', result.errors);
  return;
}

if (result.warnings.length > 0) {
  console.warn('Warnings:', result.warnings);
}

// Proceed with import...
```

---

#### `calculateImportSize(rules)`

Calculates approximate storage size for an array of rules. Internal utility.

**Signature**:
```javascript
ExportImport.calculateImportSize(rules: Array<RuleExport>) -> number
```

**Parameters**:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `rules` | Array | Yes | Array of rule objects from export file |

**Returns**: Estimated size in bytes

**Behavior**:
- Serializes rules array to JSON
- Returns byte length of resulting string
- Used to check against chrome.storage.sync quota (102,400 bytes)

**Example Usage**:
```javascript
const importSize = ExportImport.calculateImportSize(importedRules);
const currentUsage = await getCurrentStorageUsage(); // Custom helper

if (currentUsage + importSize > 102400) {
  throw new Error(`Import would exceed quota. Current: ${currentUsage}, Import: ${importSize}, Limit: 102400`);
}
```

---

## Data Contracts

### ExportFile Schema (JSON)

See `data-model.md` for complete schema. Summary:

```typescript
interface ExportFile {
  formatVersion: string;      // "1.0"
  exportedAt: string;         // ISO 8601 timestamp
  extensionVersion: string;   // Extension version from manifest
  rules: RuleExport[];        // Array of rules
}

interface RuleExport {
  id?: string;                // Optional, auto-generated if missing
  name: string;               // Required
  url_pattern: string;        // Required, valid regex
  title_pattern: string;      // Required, valid regex
  out_pattern: string;        // Required
  test_url?: string;          // Optional
  test_title?: string;        // Optional
}
```

---

## Error Codes

This module uses plain Error objects with descriptive messages. No numeric error codes.

**Error Categories**:

| Category | Example Message | Recovery |
|----------|----------------|----------|
| File I/O | "Failed to read file: [error]" | Retry with valid file |
| JSON Parsing | "Invalid JSON at line 5: Unexpected token" | Fix syntax in text editor |
| Schema Validation | "Rule #3 missing required field: name" | Add missing field |
| Storage Quota | "Import exceeds quota: 120KB / 100KB limit" | Remove existing rules or reduce import |
| Regex Validation | "Invalid regex in 'Email': Unterminated group" | Fix regex pattern |

---

## Integration Points

### With `config.js`

**Dependencies**:
- `Config.get_all(callback)`: Retrieve all rules for export
- `Config.remove_all()`: Clear rules in replace mode
- `RuleConfig(id, fields)`: Create rule instances for import
- `ruleConfig.save(callback)`: Persist imported rules

**No modifications to config.js required** - ExportImport uses existing API.

### With `options.js`

**Integration**:
```javascript
// In options.js
const exportBtn = document.getElementById('export-rules-btn');
const importBtn = document.getElementById('import-rules-btn');
const fileInput = document.getElementById('import-file-input');
const modeRadios = document.getElementsByName('import-mode');

exportBtn.addEventListener('click', async () => {
  try {
    await ExportImport.exportRules();
    showStatus('Export successful');
  } catch (error) {
    showError(`Export failed: ${error.message}`);
  }
});

importBtn.addEventListener('click', async () => {
  const file = fileInput.files[0];
  if (!file) return showError('Please select a file');

  const mode = Array.from(modeRadios).find(r => r.checked).value;

  if (mode === 'replace') {
    const confirmed = confirm(`Replace all existing rules? Current rules: ${getRuleCount()}`);
    if (!confirmed) return;
  }

  try {
    const result = await ExportImport.importRules(file, mode);
    if (result.success) {
      showStatus(`Imported ${result.importedCount} rules`);
      location.reload();
    } else {
      showError(result.errors.join('\n'));
    }
  } catch (error) {
    showError(`Import error: ${error.message}`);
  }
});
```

### With Browser APIs

**Chrome APIs Used**:
- `chrome.runtime.getManifest()`: Get extension version for export metadata
- `chrome.storage.sync`: Via Config module (no direct access)

**Web APIs Used**:
- `FileReader`: Read imported file content
- `Blob`: Create export file blob
- `URL.createObjectURL()`: Generate download URL
- `document.createElement('a')`: Trigger download

---

## Security Considerations

**Input Validation**:
- All imported data validated before storage write
- Regex patterns tested with `new RegExp()` (catches malicious patterns)
- File size limited to 10MB (prevents DoS)
- JSON parsing wrapped in try/catch (prevents injection)

**No Permissions Required**:
- File operations use browser-native APIs (no new permissions)
- Export uses blob download (no `chrome.downloads` permission)
- Import uses file input element (no filesystem access)

**CSP Compliance**:
- No eval() or Function() constructor
- No inline scripts in generated content
- No remote code loading

---

## Testing Contract

**Manual Test Cases** (from research.md):

**Export Tests**:
```javascript
// Test: Export with 0 rules
await Config.remove_all();
await ExportImport.exportRules();
// Expected: File downloads, contains empty rules array

// Test: Export with 3 rules
await createTestRules(3);
await ExportImport.exportRules();
// Expected: File contains 3 rules with all fields
```

**Import Tests**:
```javascript
// Test: Import valid file (replace)
const file = new File([validJsonContent], 'test.json', {type: 'application/json'});
const result = await ExportImport.importRules(file, 'replace');
// Expected: result.success === true, old rules gone

// Test: Import invalid JSON
const file = new File(['{ invalid json }'], 'bad.json', {type: 'application/json'});
const result = await ExportImport.importRules(file, 'replace');
// Expected: result.success === false, result.errors contains parse error

// Test: Import with duplicate ID (merge)
await createTestRules(2);
const file = new File([exportWithDuplicateIds], 'dup.json', {type: 'application/json'});
const result = await ExportImport.importRules(file, 'merge');
// Expected: result.importedCount === 2, new IDs generated, 4 total rules
```

**Validation Tests**:
```javascript
// Test: Validate missing formatVersion
const data = { rules: [] };
const result = ExportImport.validateExportFile(data);
// Expected: result.valid === false, errors contains "Missing required field: formatVersion"

// Test: Validate invalid regex
const data = {
  formatVersion: "1.0",
  rules: [{ name: "Test", url_pattern: "[invalid(", title_pattern: ".*", out_pattern: "$1" }]
};
const result = ExportImport.validateExportFile(data);
// Expected: result.valid === false, errors contains regex error
```

---

## Performance Contract

**Export Performance**:
- 10 rules: <100ms
- 100 rules: <500ms
- 1000 rules: ~2s (with loading indicator)

**Import Performance**:
- 10 rules: <200ms (validation + storage write)
- 100 rules: <1s
- 1000 rules: ~3s (with progress indicator)

**Memory**:
- Export: O(n) where n = total rules size in memory
- Import: O(n) for validation + O(n) for storage writes

---

## Version Compatibility

**Current Version**: 1.0

**Future Version Handling**:
- If `formatVersion` > "1.0": Return validation error
- If unknown fields present: Warn but import successfully
- Migration path: Future versions add migration logic in `validateExportFile()`

**Example Migration** (hypothetical v1.1):
```javascript
if (data.formatVersion === "1.0") {
  // Migrate: Add default priority field
  data.rules.forEach(rule => {
    if (!rule.priority) rule.priority = "normal";
  });
  data.formatVersion = "1.1";
}
```

---

**API Contract Status**: ✅ COMPLETE - Ready for Quickstart
