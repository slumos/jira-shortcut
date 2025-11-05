/**
 * Export/Import module for rule configurations
 * Handles file operations for sharing and backup
 *
 * Feature: 001-export-import
 * Provides export and import functionality for JIRA ShortCut rules
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
          .replace(/:/g, '-')
          .replace(/\..+/, '')
          .replace('T', '-');
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
  },

  /**
   * Validate export file schema and rule data
   * @param {object} data - Parsed JSON object
   * @returns {object} {valid, errors, warnings}
   */
  validateExportFile(data) {
    const errors = [];
    const warnings = [];

    // Validate top-level structure
    if (!data || typeof data !== 'object') {
      return { valid: false, errors: ['File must contain a valid JSON object'], warnings: [] };
    }

    // Validate formatVersion
    if (!data.formatVersion) {
      errors.push('Missing required field: formatVersion');
    } else if (data.formatVersion !== '1.0') {
      errors.push(`Unsupported format version: ${data.formatVersion} (expected 1.0)`);
    }

    // Validate rules array
    if (!data.rules) {
      errors.push('Missing required field: rules');
      return { valid: false, errors, warnings };
    }

    if (!Array.isArray(data.rules)) {
      errors.push('Field "rules" must be an array');
      return { valid: false, errors, warnings };
    }

    // Validate each rule
    const requiredFields = ['name', 'url_pattern', 'title_pattern', 'out_pattern'];

    data.rules.forEach((rule, index) => {
      const rulePrefix = `Rule ${index + 1}${rule.name ? ` ("${rule.name}")` : ''}`;
      const lineHint = ` (approximately line ${20 + index * 10})`;

      // Check required fields
      requiredFields.forEach(field => {
        if (rule[field] === undefined || rule[field] === null || rule[field] === '') {
          errors.push(`${rulePrefix}: Missing required field "${field}"${lineHint}`);
        }
      });

      // Validate name length
      if (rule.name && rule.name.length > 100) {
        errors.push(`${rulePrefix}: Name too long (max 100 characters, got ${rule.name.length})${lineHint}`);
      }

      // Validate regex patterns with helpful hints
      ['url_pattern', 'title_pattern'].forEach(field => {
        if (rule[field]) {
          try {
            new RegExp(rule[field]);
          } catch (e) {
            let hint = '';
            const pattern = rule[field];

            // Add specific hints for common regex errors
            if (e.message.includes('Unterminated character class')) {
              hint = ' - Hint: Check for unmatched square brackets [ ]';
            } else if (e.message.includes('Unmatched')) {
              hint = ' - Hint: Check for unmatched parentheses ( ) or brackets';
            } else if (pattern.includes('\\\\')) {
              hint = ' - Hint: Use single backslash in JSON strings (e.g., "\\d" not "\\\\d")';
            } else if (e.message.includes('Invalid escape')) {
              hint = ' - Hint: Check backslash escaping in pattern';
            } else if (e.message.includes('Invalid group')) {
              hint = ' - Hint: Check capture group syntax (...)';
            }

            errors.push(`${rulePrefix}: Invalid regex in "${field}": ${e.message}${hint}${lineHint}`);
          }
        }
      });

      // Check for unknown fields (forward compatibility warning)
      const knownFields = ['id', 'name', 'url_pattern', 'title_pattern', 'out_pattern', 'test_url', 'test_title'];
      Object.keys(rule).forEach(field => {
        if (!knownFields.includes(field)) {
          warnings.push(`${rulePrefix}: Unknown field "${field}" will be ignored`);
        }
      });
    });

    // Check for optional fields
    if (data.exportedAt && isNaN(Date.parse(data.exportedAt))) {
      warnings.push('Field "exportedAt" contains invalid date format');
    }

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
      // Validate file size (10MB limit)
      const MAX_FILE_SIZE = 10 * 1024 * 1024;
      if (file.size > MAX_FILE_SIZE) {
        return reject(new Error(`File too large: ${Math.round(file.size / 1024 / 1024)}MB (max 10MB)`));
      }

      // Read file content
      const reader = new FileReader();

      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };

      reader.onload = async (e) => {
        try {
          // Parse JSON
          let data;
          try {
            data = JSON.parse(e.target.result);
          } catch (parseError) {
            return reject(new Error(`Invalid JSON: ${parseError.message}`));
          }

          // Validate file structure
          const validation = ExportImport.validateExportFile(data);
          if (!validation.valid) {
            return reject(new Error(`Invalid file format:\n${validation.errors.join('\n')}`));
          }

          // Handle replace mode
          if (mode === 'replace') {
            // Calculate import size for quota check
            const importSize = JSON.stringify(data.rules).length;
            const QUOTA_LIMIT = 102400; // chrome.storage.sync quota

            if (importSize > QUOTA_LIMIT) {
              return reject(new Error(`Import too large: ${importSize} bytes (max ${QUOTA_LIMIT} bytes)`));
            }

            // Clear existing rules
            Config.remove_all();

            // Wait a bit for clear to complete
            await new Promise(resolve => setTimeout(resolve, 100));

            // Import rules
            let importedCount = 0;
            const importErrors = [];

            for (const ruleData of data.rules) {
              try {
                // Generate new ID if missing, or use existing
                const ruleId = ruleData.id || `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

                // Create RuleConfig instance
                const ruleConfig = new RuleConfig(ruleId, {
                  name: ruleData.name,
                  url_pattern: ruleData.url_pattern,
                  title_pattern: ruleData.title_pattern,
                  out_pattern: ruleData.out_pattern,
                  test_url: ruleData.test_url || '',
                  test_title: ruleData.test_title || ''
                });

                // Save rule
                await new Promise((resolveRule, rejectRule) => {
                  ruleConfig.save((err) => {
                    if (err) {
                      rejectRule(new Error(`Failed to save rule "${ruleData.name}": ${err.message}`));
                    } else {
                      resolveRule();
                    }
                  });
                });

                importedCount++;
              } catch (ruleError) {
                importErrors.push(ruleError.message);
              }
            }

            // Return results
            resolve({
              success: importErrors.length === 0,
              importedCount,
              errors: importErrors,
              warnings: validation.warnings
            });

          } else if (mode === 'merge') {
            // Get existing rules for conflict detection
            Config.get_all(async (err, existingItems) => {
              if (err) {
                return reject(new Error(`Failed to read existing rules: ${err.message}`));
              }

              try {
                // Build set of existing rule IDs
                const existingIds = new Set(Object.keys(existingItems));

                // Calculate combined size for quota check
                const existingSize = JSON.stringify(existingItems).length;
                const importSize = JSON.stringify(data.rules).length;
                const QUOTA_LIMIT = 102400;

                if (existingSize + importSize > QUOTA_LIMIT) {
                  return reject(new Error(
                    `Combined size too large: ${existingSize + importSize} bytes (max ${QUOTA_LIMIT} bytes). ` +
                    `Current: ${existingSize} bytes, Import: ${importSize} bytes`
                  ));
                }

                // Import rules with conflict resolution
                let importedCount = 0;
                const importErrors = [];
                const idConflicts = [];

                for (const ruleData of data.rules) {
                  try {
                    let ruleId = ruleData.id;

                    // Check for ID conflict
                    if (ruleId && existingIds.has(ruleId)) {
                      // Generate new unique ID
                      const newId = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                      idConflicts.push(`Rule "${ruleData.name}": ID ${ruleId} already exists, assigned new ID ${newId}`);
                      ruleId = newId;
                    } else if (!ruleId) {
                      // Generate ID if missing
                      ruleId = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    }

                    // Add to existing IDs set
                    existingIds.add(ruleId);

                    // Create RuleConfig instance
                    const ruleConfig = new RuleConfig(ruleId, {
                      name: ruleData.name,
                      url_pattern: ruleData.url_pattern,
                      title_pattern: ruleData.title_pattern,
                      out_pattern: ruleData.out_pattern,
                      test_url: ruleData.test_url || '',
                      test_title: ruleData.test_title || ''
                    });

                    // Save rule
                    await new Promise((resolveRule, rejectRule) => {
                      ruleConfig.save((err) => {
                        if (err) {
                          rejectRule(new Error(`Failed to save rule "${ruleData.name}": ${err.message}`));
                        } else {
                          resolveRule();
                        }
                      });
                    });

                    importedCount++;
                  } catch (ruleError) {
                    importErrors.push(ruleError.message);
                  }
                }

                // Combine validation warnings with ID conflict warnings
                const allWarnings = [...validation.warnings, ...idConflicts];

                // Return results
                resolve({
                  success: importErrors.length === 0,
                  importedCount,
                  errors: importErrors,
                  warnings: allWarnings
                });
              } catch (mergeError) {
                reject(mergeError);
              }
            });
          } else {
            reject(new Error(`Unknown import mode: ${mode}`));
          }

        } catch (error) {
          reject(error);
        }
      };

      reader.readAsText(file);
    });
  }

};
