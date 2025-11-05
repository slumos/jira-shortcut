# Data Model: Rule Export and Import

**Feature**: 001-export-import
**Date**: 2025-10-08
**Status**: Complete

## Overview

This feature introduces a new JSON export file format for rule configurations. No changes to the existing runtime data model (RuleConfig, BgConfig) are required - export/import operates as a serialization layer on top of existing storage.

---

## Export File Schema

### ExportFile (Top-Level)

The root object of every export file.

**Fields**:

| Field | Type | Required | Description | Validation |
|-------|------|----------|-------------|------------|
| `formatVersion` | string | Yes | Schema version (semantic versioning) | Must be "1.0" |
| `exportedAt` | string | Yes | ISO 8601 timestamp of export | Must be valid ISO 8601 |
| `extensionVersion` | string | Yes | Version of extension that created the file | Matches manifest.json version |
| `rules` | array | Yes | Array of RuleExport objects | Can be empty array |

**Example**:
```json
{
  "formatVersion": "1.0",
  "exportedAt": "2025-10-08T14:23:45.123Z",
  "extensionVersion": "7.2.0",
  "rules": [ /* RuleExport objects */ ]
}
```

**Constraints**:
- `formatVersion` determines schema compatibility (v1.0 only for MVP)
- `exportedAt` provides audit trail, not used for logic
- `extensionVersion` helps debug import issues, not used for validation

---

### RuleExport (Rule Object)

Represents a single rule configuration in the export file. Maps directly to existing `RuleConfig` fields.

**Fields**:

| Field | Type | Required | Description | Validation |
|-------|------|----------|-------------|------------|
| `id` | string | No | Rule identifier (e.g., "rule_1234567890") | If present, may be regenerated on import |
| `name` | string | Yes | Display name for the rule | Non-empty string, max 100 chars |
| `url_pattern` | string | Yes | Regex pattern to match URLs | Valid regex, tested with `new RegExp()` |
| `title_pattern` | string | Yes | Regex pattern to extract data from page title | Valid regex with capture groups |
| `out_pattern` | string | Yes | Template for formatted output | Non-empty string |
| `test_url` | string | No | Example URL for validation | Valid URL format (optional) |
| `test_title` | string | No | Example page title for validation | Any string (optional) |

**Example**:
```json
{
  "id": "rule_1696780000000",
  "name": "Email",
  "url_pattern": "(jira|tickets)*/browse/",
  "title_pattern": "^\\[#?([^\\]]+)\\](.*)( -[^-]+)$",
  "out_pattern": "$html:<a href=\"$url\">$1:$2</a>",
  "test_url": "https://issues.apache.org/jira/browse/HADOOP-3629",
  "test_title": "[HADOOP-3629] Document the metrics produced by hadoop - JIRA"
}
```

**Constraints**:
- All regex patterns must be valid JavaScript regex (no lookbehind in older browsers)
- `id` is optional in import file (will be auto-generated if missing)
- Field order doesn't matter (JSON object)
- Unknown fields are ignored (forward compatibility)

---

## Existing Data Model (No Changes)

### RuleConfig (Runtime)

Existing class in `config.js`. Export/import translates between JSON and RuleConfig instances.

**Fields** (from AGENTS.md):
- `id`: Auto-generated timestamp-based ID
- `fields`: Object containing all rule properties (name, patterns, test data)
- Methods: `save()`, `load()`, `remove()`, `match()`, `apply()`

**Relationship to Export**:
- Export: Call `Config.get_all()` → iterate RuleConfig instances → serialize to RuleExport JSON
- Import: Parse JSON → create new RuleConfig instances → call `save()` for each

---

### Config (Storage Layer)

Existing singleton in `config.js`. Export/import uses existing methods.

**Relevant Methods**:
- `Config.get_all(callback)`: Returns all rules from chrome.storage.sync
- `Config.set(key, value, callback)`: Saves a rule
- `Config.remove_all()`: Clears all rules (used in replace mode)

**No changes needed** - export/import orchestrates existing Config methods.

---

## Data Flow

### Export Flow

```
User clicks "Export Rules"
  ↓
options.js: ExportImport.exportRules()
  ↓
Config.get_all() → Array<RuleConfig>
  ↓
Build ExportFile object:
  - formatVersion: "1.0"
  - exportedAt: new Date().toISOString()
  - extensionVersion: chrome.runtime.getManifest().version
  - rules: RuleConfig[] → RuleExport[]
  ↓
JSON.stringify(exportFile, null, 2)
  ↓
Create Blob(jsonString, {type: 'application/json'})
  ↓
Trigger download via createObjectURL + anchor click
```

### Import Flow (Replace Mode)

```
User selects file + clicks "Import (Replace)"
  ↓
Confirm dialog: "Replace all rules?"
  ↓ (if confirmed)
options.js: ExportImport.importRules(file, 'replace')
  ↓
FileReader.readAsText(file)
  ↓
JSON.parse(content) → ExportFile
  ↓
Validate schema (formatVersion, required fields, regex patterns)
  ↓ (if invalid)
Return error → Display to user
  ↓ (if valid)
Config.remove_all() → Clear existing rules
  ↓
For each RuleExport in exportFile.rules:
  - Create new RuleConfig(auto-generated-id, ruleExport)
  - ruleConfig.save()
  ↓
Reload Options page to show imported rules
```

### Import Flow (Merge Mode)

```
User selects file + clicks "Import (Merge)"
  ↓
options.js: ExportImport.importRules(file, 'merge')
  ↓
FileReader.readAsText(file)
  ↓
JSON.parse(content) → ExportFile
  ↓
Validate schema (same as replace)
  ↓ (if invalid)
Return error → Display to user
  ↓ (if valid)
Config.get_all() → Get existing rule IDs
  ↓
For each RuleExport in exportFile.rules:
  - If ruleExport.id exists in storage:
      Generate new ID (rule_${Date.now()}_${Math.random()})
  - Create new RuleConfig(id, ruleExport)
  - ruleConfig.save()
  ↓
Reload Options page to show merged rules
```

---

## Validation Rules

### Import Validation Stages

**Stage 1: JSON Parsing**
- Input: File content as string
- Check: Valid JSON syntax
- Error: "Invalid JSON: [parse error message]"

**Stage 2: Schema Structure**
- Check: Has `formatVersion`, `rules` fields
- Check: `formatVersion` === "1.0"
- Error: "Missing required field: [field]" or "Unsupported format version: [version]"

**Stage 3: Rule Validation**
- For each rule in `rules` array:
  - Check: Has `name`, `url_pattern`, `title_pattern`, `out_pattern`
  - Check: `name` is non-empty string
  - Check: Patterns are valid regex via `new RegExp(pattern)`
- Error: "Rule #[index] missing required field: [field]" or "Invalid regex in rule '[name]': [error]"

**Stage 4: Storage Quota (Pre-Write)**
- Calculate total import size (JSON.stringify all rules)
- Check: Current storage usage + import size < 102,400 bytes
- Error: "Import exceeds storage quota. Current: [used] bytes, Import: [import] bytes, Limit: 102,400 bytes"

---

## State Transitions

### Export State Machine

```
IDLE (Options page loaded)
  ↓ (user clicks Export)
EXPORTING (gathering rules from storage)
  ↓
DOWNLOADED (file saved to disk)
  ↓
IDLE
```

No persistent state - export is stateless operation.

### Import State Machine

```
IDLE (Options page loaded)
  ↓ (user selects file)
FILE_SELECTED (file in input element)
  ↓ (user selects mode + clicks Import)
VALIDATING (reading file, parsing JSON, checking schema)
  ↓ (if error)
ERROR (show error message)
  ↓ (user fixes file and retries)
FILE_SELECTED
  ↓ (if valid)
IMPORTING (writing rules to storage)
  ↓
SUCCESS (rules imported, page reloads)
  ↓
IDLE (page reloaded, new rules visible)
```

**Atomic Operations**:
- Replace mode: All-or-nothing (if any rule fails validation, no writes occur)
- Merge mode: All-or-nothing (same as replace)

---

## Error Handling

### Export Errors

| Error Condition | Error Message | Recovery |
|----------------|---------------|----------|
| Storage read fails | "Failed to read rules: [error]" | Retry export |
| Browser blocks download | "Download blocked. Check browser settings." | User enables downloads |
| Out of memory (large export) | "Export failed: Out of memory" | Reduce rule count |

### Import Errors

| Error Condition | Error Message | Recovery |
|----------------|---------------|----------|
| Invalid JSON | "Invalid JSON at line [line]: [error]" | Fix syntax in text editor |
| Missing formatVersion | "Missing required field: formatVersion" | Add field manually |
| Unsupported version | "Format version [version] not supported. Supported: 1.0" | Use compatible file |
| Missing required field | "Rule #[index] missing field: [field]" | Add field to rule object |
| Invalid regex | "Invalid regex in rule '[name]': [error]" | Fix regex pattern |
| Storage quota exceeded | "Import exceeds quota: [details]" | Remove existing rules |
| File too large | "File size [size]MB exceeds limit (10MB)" | Check if correct file |

---

## Backward/Forward Compatibility

### Forward Compatibility (Future Export → Current Import)

**Strategy**: Ignore unknown fields
- If future version adds `"priority"` field, v1.0 import ignores it
- Import succeeds, rule works (missing fields use defaults)

**Example**:
```json
{
  "formatVersion": "1.1",  // Future version
  "priority": "high",      // Unknown field (ignored)
  "rules": [ /* ... */ ]
}
```
**Behavior**: Import shows warning "Unknown fields ignored: priority" but succeeds

### Backward Compatibility (Current Export → Future Import)

**Strategy**: Format version check
- Future extension checks `formatVersion === "1.0"`
- Applies any necessary migrations (e.g., add default `priority: "normal"`)

---

## Performance Considerations

### Export Performance

| Rule Count | Export Time | File Size |
|------------|-------------|-----------|
| 10 rules | <100ms | ~5KB |
| 100 rules | <500ms | ~50KB |
| 1000 rules | ~2s | ~500KB |

**Bottlenecks**:
- `JSON.stringify` is synchronous (blocks UI for large exports)
- Mitigation: Show loading indicator for >100 rules

### Import Performance

| File Size | Import Time | Validation |
|-----------|-------------|------------|
| 5KB (10 rules) | <200ms | <50ms |
| 50KB (100 rules) | <1s | <200ms |
| 500KB (1000 rules) | ~3s | ~500ms |

**Bottlenecks**:
- Regex validation (tests each pattern with `new RegExp()`)
- Storage writes (chrome.storage.sync is async)
- Mitigation: Batch validation, show progress for >100 rules

---

## Summary

**New Entities**:
- `ExportFile`: Top-level export file schema (formatVersion, exportedAt, rules)
- `RuleExport`: Serialized rule object (maps to RuleConfig)

**Existing Entities (Unchanged)**:
- `RuleConfig`: Runtime rule representation
- `Config`: Storage layer for chrome.storage.sync

**Data Flows**:
- Export: RuleConfig[] → ExportFile JSON → Blob → Download
- Import: File → JSON → Validate → RuleConfig[] → Storage

**Validation**: 4-stage process (parse, schema, rules, quota)

**Compatibility**: Forward (ignore unknown fields), Backward (version migrations)

---

**Data Model Status**: ✅ COMPLETE - Ready for Contract Design
