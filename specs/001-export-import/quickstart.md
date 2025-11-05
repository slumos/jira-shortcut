# Quickstart: Rule Export and Import Implementation

**Feature**: 001-export-import
**Date**: 2025-10-08
**For**: Developers implementing this feature

## Overview

This guide provides step-by-step instructions for implementing the rule export/import feature. Implementation follows the 4 prioritized user stories (P1-P4) from spec.md.

**Estimated Effort**: 6-8 hours (including testing)

---

## Prerequisites

Before starting:
1. Read `AGENTS.md` (project architecture and terminology)
2. Read `spec.md` (user requirements and acceptance criteria)
3. Read `research.md` (technical decisions and API choices)
4. Read `data-model.md` (export file schema and validation rules)
5. Read `contracts/export-import-api.md` (module API specification)

**Key Files to Modify**:
- `jira/options.html` - Add UI for export/import buttons
- `jira/css/options.css` - Style new UI elements
- `jira/js/export-import.js` - **NEW FILE** - Core export/import logic
- `jira/js/options.js` - Wire up UI event handlers

**Files NOT Modified**:
- `jira/manifest.json` - No new permissions needed
- `jira/js/config.js` - Use existing API (no changes)
- `jira/js/popup.js`, `jira/js/service_worker.js` - Not involved

---

## Implementation Phases

### Phase 1: User Story 1 - Export All Rules (P1)

**Goal**: User can click "Export Rules" button and download a JSON file with all configured rules.

**Steps**:

#### 1.1: Create `export-import.js` Module

Create `jira/js/export-import.js`:

```javascript
/**
 * Export/Import module for rule configurations
 * Handles file operations for sharing and backup
 */
const ExportImport = {

  /**
   * Export all rules to a JSON file
   * @returns {Promise<void>}
   */
  async exportRules() {
    return new Promise((resolve, reject) => {
      // Get all rules from storage
      Config.get_all((err, items) => {
        if (err) {
          return reject(new Error(`Failed to read rules: ${err.message}`));
        }

        // Build export file structure
        const exportFile = {
          formatVersion: "1.0",
          exportedAt: new Date().toISOString(),
          extensionVersion: chrome.runtime.getManifest().version,
          rules: []
        };

        // Convert storage items to rule array
        for (const ruleId in items) {
          const rule = items[ruleId];
          exportFile.rules.push({
            id: ruleId,
            name: rule.name,
            url_pattern: rule.url_pattern,
            title_pattern: rule.title_pattern,
            out_pattern: rule.out_pattern,
            test_url: rule.test_url,
            test_title: rule.test_title
          });
        }

        // Serialize to pretty JSON
        const jsonString = JSON.stringify(exportFile, null, 2);

        // Create blob and trigger download
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        // Generate filename with timestamp
        const timestamp = new Date().toISOString()
          .replace(/:/g, '')
          .replace(/\..+/, '')
          .replace('T', '');
        const filename = `jira-shortcut-rules-${timestamp}.json`;

        // Create temporary anchor and click to download
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();

        // Cleanup
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          resolve();
        }, 100);
      });
    });
  }

};
```

**Test**:
1. Open browser console, run `ExportImport.exportRules()`
2. Verify file downloads with correct name and JSON content

#### 1.2: Add Export UI to Options Page

Edit `jira/options.html` - Add before the "Add rule" button:

```html
<!-- Export/Import Controls -->
<div id="export-import-controls">
  <h3>Backup & Sharing</h3>
  <button type="button" id="export-rules-btn">Export All Rules</button>
  <div id="export-status"></div>
</div>
```

#### 1.3: Wire Export Button in `options.js`

Edit `jira/js/options.js` - Add to `Options` constructor after existing button initialization:

```javascript
this.buttons = {
  add_rule: document.getElementById('add_rule'),
  delete_all_rules: document.getElementById('delete_all_rules'),
  export_rules: document.getElementById('export-rules-btn')  // NEW
};
```

Add to `init_listeners()`:

```javascript
this.buttons.export_rules.addEventListener('click', async () => {
  try {
    await ExportImport.exportRules();
    this.showExportStatus('Export successful!', 'success');
  } catch (error) {
    this.showExportStatus(`Export failed: ${error.message}`, 'error');
  }
});
```

Add helper method:

```javascript
this.showExportStatus = function(message, type) {
  const statusDiv = document.getElementById('export-status');
  statusDiv.textContent = message;
  statusDiv.className = type;
  setTimeout(() => {
    statusDiv.textContent = '';
    statusDiv.className = '';
  }, 3000);
};
```

#### 1.4: Style Export Controls

Edit `jira/css/options.css` - Add:

```css
#export-import-controls {
  margin: 20px 0;
  padding: 15px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #f9f9f9;
}

#export-import-controls h3 {
  margin-top: 0;
}

#export-rules-btn {
  background-color: #4285f4;
  color: white;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-right: 10px;
}

#export-rules-btn:hover {
  background-color: #357ae8;
}

#export-status {
  display: inline-block;
  padding: 5px 10px;
  margin-left: 10px;
}

#export-status.success {
  color: green;
}

#export-status.error {
  color: red;
}
```

**Test**:
1. Load extension in `chrome://extensions` (Developer mode)
2. Open Options page
3. Click "Export All Rules"
4. Verify file downloads
5. Open file in text editor, verify JSON structure

**Acceptance Criteria** (from spec.md US1):
- ✅ User has 3 rules → Export downloads file with 3 rules
- ✅ User has 0 rules → Export downloads file with empty rules array
- ✅ File is readable in text editor

---

### Phase 2: User Story 2 - Import Rules (Replace) (P2)

**Goal**: User can import a JSON file and replace all existing rules.

#### 2.1: Add Import Validation to `export-import.js`

Add to `ExportImport` object:

```javascript
/**
 * Validate export file schema and rule data
 * @param {object} data - Parsed JSON object
 * @returns {object} {valid, errors, warnings}
 */
validateExportFile(data) {
  const errors = [];
  const warnings = [];

  // Check required top-level fields
  if (!data.formatVersion) {
    errors.push('Missing required field: formatVersion');
  } else if (data.formatVersion !== '1.0') {
    errors.push(`Unsupported format version: ${data.formatVersion}. Supported: 1.0`);
  }

  if (!data.rules) {
    errors.push('Missing required field: rules');
  } else if (!Array.isArray(data.rules)) {
    errors.push('Field "rules" must be an array');
  } else {
    // Validate each rule
    data.rules.forEach((rule, index) => {
      const required = ['name', 'url_pattern', 'title_pattern', 'out_pattern'];
      required.forEach(field => {
        if (!rule[field]) {
          errors.push(`Rule #${index + 1} missing required field: ${field}`);
        }
      });

      // Validate regex patterns
      ['url_pattern', 'title_pattern'].forEach(field => {
        if (rule[field]) {
          try {
            new RegExp(rule[field]);
          } catch (e) {
            errors.push(`Invalid regex in rule '${rule.name || index + 1}' field '${field}': ${e.message}`);
          }
        }
      });

      // Validate name length
      if (rule.name && rule.name.length > 100) {
        errors.push(`Rule #${index + 1} name exceeds 100 characters`);
      }
    });
  }

  // Check for unknown fields (warnings only)
  const knownFields = ['formatVersion', 'exportedAt', 'extensionVersion', 'rules'];
  Object.keys(data).forEach(key => {
    if (!knownFields.includes(key)) {
      warnings.push(`Unknown field '${key}' will be ignored`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
},

/**
 * Import rules from JSON file
 * @param {File} file - File object from input element
 * @param {string} mode - 'replace' or 'merge'
 * @returns {Promise<object>} {success, importedCount, errors, warnings}
 */
async importRules(file, mode) {
  return new Promise((resolve, reject) => {
    // Validate file size
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return resolve({
        success: false,
        importedCount: 0,
        errors: [`File size ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds limit (10MB)`],
        warnings: []
      });
    }

    // Read file content
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        // Parse JSON
        const content = e.target.result.trim();
        let data;
        try {
          data = JSON.parse(content);
        } catch (parseError) {
          return resolve({
            success: false,
            importedCount: 0,
            errors: [`Invalid JSON: ${parseError.message}`],
            warnings: []
          });
        }

        // Validate schema
        const validation = this.validateExportFile(data);
        if (!validation.valid) {
          return resolve({
            success: false,
            importedCount: 0,
            errors: validation.errors,
            warnings: validation.warnings
          });
        }

        // Calculate storage size
        const importSize = JSON.stringify(data.rules).length;
        const storageLimit = 102400; // chrome.storage.sync limit

        // Execute import based on mode
        if (mode === 'replace') {
          // Clear existing rules
          Config.remove_all();

          // Check quota before importing
          if (importSize > storageLimit) {
            return resolve({
              success: false,
              importedCount: 0,
              errors: [`Import size ${importSize} bytes exceeds storage limit ${storageLimit} bytes`],
              warnings: validation.warnings
            });
          }

          // Import all rules
          let imported = 0;
          const importErrors = [];

          for (const ruleData of data.rules) {
            const ruleId = ruleData.id || `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const ruleConfig = new RuleConfig(ruleId, {
              name: ruleData.name,
              url_pattern: ruleData.url_pattern,
              title_pattern: ruleData.title_pattern,
              out_pattern: ruleData.out_pattern,
              test_url: ruleData.test_url || '',
              test_title: ruleData.test_title || ''
            });

            await new Promise((saveResolve) => {
              ruleConfig.save((err) => {
                if (err) {
                  importErrors.push(`Failed to save rule '${ruleData.name}': ${err.message}`);
                } else {
                  imported++;
                }
                saveResolve();
              });
            });
          }

          resolve({
            success: importErrors.length === 0,
            importedCount: imported,
            errors: importErrors,
            warnings: validation.warnings
          });

        } else {
          // Merge mode (will implement in Phase 3)
          resolve({
            success: false,
            importedCount: 0,
            errors: ['Merge mode not yet implemented'],
            warnings: []
          });
        }

      } catch (error) {
        resolve({
          success: false,
          importedCount: 0,
          errors: [`Import failed: ${error.message}`],
          warnings: []
        });
      }
    };

    reader.onerror = () => {
      resolve({
        success: false,
        importedCount: 0,
        errors: [`Failed to read file: ${reader.error.message}`],
        warnings: []
      });
    };

    reader.readAsText(file, 'UTF-8');
  });
}
```

#### 2.2: Add Import UI to Options Page

Edit `jira/options.html` - Add to export-import-controls div:

```html
<div id="import-section">
  <label for="import-file-input">Import Rules:</label>
  <input type="file" id="import-file-input" accept=".json" />

  <div id="import-mode-selection">
    <label>
      <input type="radio" name="import-mode" value="replace" checked />
      Replace existing rules
    </label>
    <label>
      <input type="radio" name="import-mode" value="merge" />
      Merge with existing rules
    </label>
  </div>

  <button type="button" id="import-rules-btn">Import Rules</button>
  <div id="import-status"></div>
</div>
```

#### 2.3: Wire Import Button in `options.js`

Add to buttons object:

```javascript
this.buttons = {
  // ... existing buttons
  import_rules: document.getElementById('import-rules-btn')
};
```

Add to `init_listeners()`:

```javascript
document.getElementById('import-rules-btn').addEventListener('click', async () => {
  const fileInput = document.getElementById('import-file-input');
  const file = fileInput.files[0];

  if (!file) {
    this.showImportStatus('Please select a file', 'error');
    return;
  }

  const mode = document.querySelector('input[name="import-mode"]:checked').value;

  // Confirm replace mode
  if (mode === 'replace') {
    const ruleCount = Object.keys(await this.getCurrentRules()).length;
    const confirmed = confirm(
      `Replace all existing rules?\n\nThis will delete your ${ruleCount} current rule(s) and cannot be undone.`
    );
    if (!confirmed) {
      return;
    }
  }

  // Show loading
  this.showImportStatus('Importing...', 'loading');

  try {
    const result = await ExportImport.importRules(file, mode);

    if (result.success) {
      this.showImportStatus(`✓ Imported ${result.importedCount} rules`, 'success');
      if (result.warnings.length > 0) {
        console.warn('Import warnings:', result.warnings);
      }
      // Reload page to show new rules
      setTimeout(() => location.reload(), 1500);
    } else {
      this.showImportStatus('Import failed', 'error');
      alert('Import errors:\n\n' + result.errors.join('\n'));
    }
  } catch (error) {
    this.showImportStatus(`Error: ${error.message}`, 'error');
  }
});
```

Add helper methods:

```javascript
this.getCurrentRules = function() {
  return new Promise((resolve) => {
    Config.get_all((err, items) => {
      resolve(err ? {} : items);
    });
  });
};

this.showImportStatus = function(message, type) {
  const statusDiv = document.getElementById('import-status');
  statusDiv.textContent = message;
  statusDiv.className = type;
  if (type !== 'loading') {
    setTimeout(() => {
      statusDiv.textContent = '';
      statusDiv.className = '';
    }, 3000);
  }
};
```

#### 2.4: Style Import Controls

Add to `options.css`:

```css
#import-section {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #ddd;
}

#import-file-input {
  display: block;
  margin: 10px 0;
}

#import-mode-selection {
  margin: 10px 0;
}

#import-mode-selection label {
  display: block;
  margin: 5px 0;
}

#import-rules-btn {
  background-color: #34a853;
  color: white;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

#import-rules-btn:hover {
  background-color: #2d8e47;
}

#import-status {
  display: inline-block;
  padding: 5px 10px;
  margin-left: 10px;
}

#import-status.loading {
  color: #4285f4;
}
```

**Test**:
1. Export rules from one profile
2. Open Options in another profile (or clear rules)
3. Import file with "Replace" mode
4. Verify old rules replaced with imported rules
5. Test error cases: invalid JSON, missing fields

**Acceptance Criteria** (from spec.md US2):
- ✅ Import valid file with replace → old rules gone, new rules active
- ✅ Import invalid file → error shown, no changes
- ✅ Import success → new rules visible in Options page

---

### Phase 3: User Story 3 - Import Rules (Merge) (P3)

**Goal**: User can import rules and merge with existing configuration.

#### 3.1: Implement Merge Mode in `export-import.js`

Replace the "Merge mode not yet implemented" section in `importRules()`:

```javascript
} else if (mode === 'merge') {
  // Get existing rule IDs
  const existingRules = await new Promise((resolve) => {
    Config.get_all((err, items) => {
      resolve(err ? {} : items);
    });
  });

  const existingIds = new Set(Object.keys(existingRules));
  const currentSize = JSON.stringify(existingRules).length;

  // Check quota before importing
  if (currentSize + importSize > storageLimit) {
    return resolve({
      success: false,
      importedCount: 0,
      errors: [
        `Import would exceed storage quota.`,
        `Current: ${currentSize} bytes, Import: ${importSize} bytes, Limit: ${storageLimit} bytes`
      ],
      warnings: validation.warnings
    });
  }

  // Import rules with ID conflict resolution
  let imported = 0;
  const importErrors = [];
  const idConflicts = [];

  for (const ruleData of data.rules) {
    let ruleId = ruleData.id;

    // Check for ID conflict
    if (ruleId && existingIds.has(ruleId)) {
      // Generate new ID
      ruleId = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      idConflicts.push(`Rule '${ruleData.name}' ID conflict resolved (new ID: ${ruleId})`);
    } else if (!ruleId) {
      // Generate ID if missing
      ruleId = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    const ruleConfig = new RuleConfig(ruleId, {
      name: ruleData.name,
      url_pattern: ruleData.url_pattern,
      title_pattern: ruleData.title_pattern,
      out_pattern: ruleData.out_pattern,
      test_url: ruleData.test_url || '',
      test_title: ruleData.test_title || ''
    });

    await new Promise((saveResolve) => {
      ruleConfig.save((err) => {
        if (err) {
          importErrors.push(`Failed to save rule '${ruleData.name}': ${err.message}`);
        } else {
          imported++;
        }
        saveResolve();
      });
    });
  }

  const allWarnings = [...validation.warnings, ...idConflicts];

  resolve({
    success: importErrors.length === 0,
    importedCount: imported,
    errors: importErrors,
    warnings: allWarnings
  });
}
```

**Test**:
1. Create 2 rules manually
2. Export 3 rules from another profile
3. Import with "Merge" mode
4. Verify 5 total rules (2 original + 3 imported)
5. Test ID conflict: Export rules, import same file with merge → IDs regenerated

**Acceptance Criteria** (from spec.md US3):
- ✅ Merge with 2 existing + 3 imported = 5 total rules
- ✅ Duplicate IDs regenerated automatically
- ✅ Both original and imported rules visible

---

### Phase 4: User Story 4 - Edit Exported Rules with Scripts (P4)

**Goal**: Enable power users to edit exported files and re-import successfully.

**Implementation Notes**:
- No code changes needed - functionality comes from US1-3
- Focus on validation error messages for common editing mistakes

#### 4.1: Enhance Error Messages

Improve error messages in `validateExportFile()` to help with manual editing:

```javascript
// Enhanced error messages for manual editing
if (!rule.name) {
  errors.push(`Rule #${index + 1}: Missing "name" field (line ~${this.estimateLine(data, index)})`);
}

// Add regex error hints
try {
  new RegExp(rule[field]);
} catch (e) {
  let hint = '';
  if (e.message.includes('Unterminated')) {
    hint = ' - Check for missing closing bracket or parenthesis';
  }
  errors.push(`Invalid regex in rule '${rule.name}' field '${field}': ${e.message}${hint}`);
}
```

**Test**:
1. Export 1 rule
2. Duplicate in text editor, modify name/patterns
3. Import modified file → verify all rules imported
4. Introduce syntax error (missing quote, bracket)
5. Import → verify clear error message with location

**Acceptance Criteria** (from spec.md US4):
- ✅ Duplicate and modify with find/replace → import succeeds
- ✅ Generate 50 rules via script → import succeeds
- ✅ Syntax error → clear error with line/location

---

## Testing Checklist

### Manual Test Cases

**Export Tests**:
- [ ] Export with 0 rules → file contains empty array
- [ ] Export with 3 rules → file contains all fields (name, patterns, test data)
- [ ] Open file in text editor (VS Code, Notepad) → valid JSON, readable
- [ ] Export filename includes timestamp (no overwrites)

**Import Replace Tests**:
- [ ] Import valid file → old rules replaced
- [ ] Confirmation dialog shown before replace
- [ ] Import invalid JSON → error shown, no changes
- [ ] Import missing required field → error shown, no changes
- [ ] Import invalid regex → error shown, no changes
- [ ] Import future formatVersion → error shown

**Import Merge Tests**:
- [ ] Merge: 2 existing + 3 imported = 5 total
- [ ] Merge with duplicate ID → new ID generated, both rules present
- [ ] Merge without confirmation (non-destructive)

**Edit & Re-import Tests**:
- [ ] Export → edit in text editor → import → changes preserved
- [ ] Find/replace to modify patterns → import succeeds
- [ ] Add unicode characters (emoji in name) → round-trip preserved
- [ ] Syntax error (missing quote) → clear error message

**Edge Cases**:
- [ ] Import file >10MB → error shown
- [ ] Import 1000 rules → quota warning or success
- [ ] Export then immediate import → lossless round-trip

**Cross-Browser**:
- [ ] Repeat key tests on Chrome, Edge, Brave

---

## Deployment Steps

1. **Code Review**: Ensure all files follow project conventions
2. **Test**: Complete testing checklist above
3. **Update manifest version**: Bump version in `jira/manifest.json`
4. **Build**: Run `./build.sh` to create release ZIP
5. **Test build**: Load unpacked extension from ZIP
6. **Update README**: Document export/import feature
7. **Store listing**: Update Chrome Web Store description

---

## Troubleshooting

### Common Issues

**Export doesn't trigger download**:
- Check browser download settings (not blocking downloads)
- Check console for errors
- Verify `Config.get_all()` returns data

**Import fails with "Invalid JSON"**:
- Open file in JSON validator (jsonlint.com)
- Check for trailing commas (not valid JSON)
- Check for unescaped special characters in strings

**Import shows quota error**:
- Check current storage usage: `chrome.storage.sync.getBytesInUse()`
- Remove unused rules or reduce imported rules
- Each rule ~400 bytes, limit is ~100KB total

**Merge mode creates duplicate names**:
- Expected behavior - names are not unique identifiers
- User can manually rename via Options page
- IDs are guaranteed unique

---

## Performance Notes

- Export is synchronous (blocks UI for ~2s with 1000 rules) - consider async for very large exports
- Import validation tests each regex pattern - expect ~500ms for 100 rules
- Page reload after import is simplest UX (alternative: refresh Options UI without reload)

---

## Future Enhancements (Out of Scope for MVP)

- Selective export (checkboxes to choose rules)
- Import diff preview (show which rules will be added/replaced)
- Drag & drop file import
- YAML format support (requires parser library)
- Compressed export for large rule sets
- Import from URL (share via gist, pastebin)

---

**Quickstart Status**: ✅ COMPLETE - Ready for Implementation
