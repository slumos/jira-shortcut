var Options = function() {

  this.template = document.getElementById('rule_template')

  this.buttons = {
    add_rule: document.getElementById('add_rule'),
    delete_all_rules: document.getElementById('delete_all_rules'),
    export_rules: document.getElementById('export-rules-btn'),
    import_replace: document.getElementById('import-replace-btn'),
    import_merge: document.getElementById('import-merge-btn')
  };

  this.import_file_input = document.getElementById('import-file-input');

  this.init = function() {
    this.template.id = '';
    this.template.remove();

    this.init_listeners();
    this.init_rules();
  };

  this.init_listeners = function() {
    this.buttons.add_rule.addEventListener(
      'click', this.add_rule.bind(this, null));

    this.buttons.delete_all_rules.addEventListener(
      'click', this.delete_all_rules);

    this.buttons.export_rules.addEventListener('click', async () => {
      try {
        await ExportImport.exportRules();
        this.showExportStatus('Export successful!', 'success');
      } catch (error) {
        this.showExportStatus(`Export failed: ${error.message}`, 'error');
      }
    });

    const handleImport = async (mode) => {
      const file = this.import_file_input.files[0];

      if (!file) {
        this.showImportStatus('Please select a file first', 'error');
        return;
      }

      // Show confirmation for replace mode
      if (mode === 'replace') {
        const currentCount = await this.getCurrentRulesCount();
        const message = currentCount > 0
          ? `This will delete all ${currentCount} existing rules and replace them with imported rules. Continue?`
          : 'This will replace all rules with imported rules. Continue?';

        if (!confirm(message)) {
          return;
        }
      }

      // Perform import
      try {
        this.showImportStatus('Importing...', 'loading');
        this.buttons.import_replace.disabled = true;
        this.buttons.import_merge.disabled = true;

        const result = await ExportImport.importRules(file, mode);

        if (result.success) {
          this.showImportStatus(`Successfully imported ${result.importedCount} rules!`, 'success');

          // Show warnings if any
          if (result.warnings.length > 0) {
            console.warn('Import warnings:', result.warnings);
          }

          // Reload page after short delay
          setTimeout(() => {
            location.reload();
          }, 1500);
        } else {
          const errorMsg = `Import completed with errors:\n${result.errors.join('\n')}`;
          this.showImportStatus('Import had errors (see console)', 'error');
          console.error(errorMsg);
          alert(errorMsg);
        }
      } catch (error) {
        this.showImportStatus(`Import failed: ${error.message}`, 'error');
        alert(`Import failed:\n${error.message}`);
      } finally {
        this.buttons.import_replace.disabled = false;
        this.buttons.import_merge.disabled = false;
      }
    };

    this.buttons.import_replace.addEventListener('click', () => handleImport('replace'));
    this.buttons.import_merge.addEventListener('click', () => handleImport('merge'));
  };

  this.add_rule = function(id) {
    var ruleNode = this.template.cloneNode(true);

    document.body.insertBefore(ruleNode, this.buttons.add_rule);
    new Rule(ruleNode, new RuleConfig(id));
  };

  this.delete_all_rules = function() {
    var confirmed = confirm('Delete all rules?');
    if (confirmed) {
      Config.remove_all();
      location.reload();
    }
  };

  this.init_rules = function() {
    Config.get_all(this.init_rules_callback.bind(this));
  };

  this.init_rules_callback = function(err, items) {
    if (err) { console.log(err); return; };
    Object.keys(items).sort().forEach(this.add_rule.bind(this));
  };

  this.showExportStatus = function(message, type) {
    const statusDiv = document.getElementById('export-status');
    statusDiv.textContent = message;
    statusDiv.className = type;
    setTimeout(() => {
      statusDiv.textContent = '';
      statusDiv.className = '';
    }, 3000);
  };

  this.showImportStatus = function(message, type) {
    const statusDiv = document.getElementById('import-status');
    statusDiv.textContent = message;
    statusDiv.className = type;
    // Don't auto-clear for loading status
    if (type !== 'loading') {
      setTimeout(() => {
        statusDiv.textContent = '';
        statusDiv.className = '';
      }, 3000);
    }
  };

  this.getCurrentRulesCount = function() {
    return new Promise((resolve) => {
      Config.get_all((err, items) => {
        if (err) {
          resolve(0);
        } else {
          resolve(Object.keys(items).length);
        }
      });
    });
  };

  this.init();
}
document.addEventListener('DOMContentLoaded', function() { new Options() });
