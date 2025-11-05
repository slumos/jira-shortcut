# Tasks: Rule Export and Import

**Input**: Design documents from `/specs/001-export-import/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Manual testing only - no automated test framework in place

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions
- **Browser extension structure**: `jira/` at repository root
- All changes localized to Options page and configuration

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure for export/import feature

- [x] T001 Create new module file jira/js/export-import.js with ExportImport object skeleton
- [x] T002 Add script reference to jira/options.html for export-import.js module
- [x] T003 [P] Create backup of jira/options.html, jira/css/options.css, jira/js/options.js before modifications

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: No foundational/blocking tasks needed - feature uses existing infrastructure

**Note**: This feature builds on existing Config and RuleConfig classes. No blocking prerequisites required before user story implementation.

**Checkpoint**: Setup complete - user story implementation can begin

---

## Phase 3: User Story 1 - Export All Rules (Priority: P1) 🎯 MVP

**Goal**: User can export all configured rules to a downloadable JSON file for backup and sharing

**Independent Test**: Create 3 rules, click Export, verify file downloads with all rules in human-readable JSON format

### Implementation for User Story 1

- [x] T004 [US1] Implement ExportImport.exportRules() method in jira/js/export-import.js
  - Call Config.get_all() to retrieve rules from storage
  - Build ExportFile JSON structure (formatVersion, exportedAt, extensionVersion, rules array)
  - Serialize to pretty-printed JSON with 2-space indentation
  - Generate timestamped filename (jira-shortcut-rules-YYYYMMDD-HHmmss.json)
  - Create Blob with application/json MIME type
  - Trigger download via URL.createObjectURL() and temporary anchor element
  - Clean up object URL after download

- [x] T005 [P] [US1] Add export UI section to jira/options.html before "Add rule" button
  - Create export-import-controls div wrapper
  - Add "Backup & Sharing" heading
  - Add "Export All Rules" button with id="export-rules-btn"
  - Add export-status div for feedback messages

- [x] T006 [P] [US1] Style export UI controls in jira/css/options.css
  - Style #export-import-controls container (padding, border, background)
  - Style #export-rules-btn (blue background, white text, hover effect)
  - Style #export-status with success/error color classes

- [x] T007 [US1] Wire export button in jira/js/options.js
  - Add export_rules to this.buttons object
  - Add event listener in init_listeners() to call ExportImport.exportRules()
  - Implement showExportStatus() helper method for user feedback
  - Handle errors with try/catch and display error messages

**Checkpoint**: User Story 1 complete - export functionality fully operational and independently testable

---

## Phase 4: User Story 2 - Import Rules (Replace) (Priority: P2)

**Goal**: User can import a JSON file and replace all existing rules with confirmation prompt

**Independent Test**: Export rules from one profile, import into another with "replace" option, verify imported rules work

### Implementation for User Story 2

- [ ] T008 [P] [US2] Implement ExportImport.validateExportFile() method in jira/js/export-import.js
  - Validate required top-level fields (formatVersion, rules)
  - Check formatVersion === "1.0"
  - Validate rules is an array
  - For each rule: check required fields (name, url_pattern, title_pattern, out_pattern)
  - Validate regex patterns with new RegExp() (catch syntax errors)
  - Validate name length (<= 100 chars)
  - Collect warnings for unknown fields (forward compatibility)
  - Return {valid, errors, warnings} object

- [ ] T009 [US2] Implement ExportImport.importRules() method (replace mode only) in jira/js/export-import.js
  - Validate file size (<10MB)
  - Read file content with FileReader.readAsText()
  - Parse JSON with try/catch for syntax errors
  - Call validateExportFile() and return errors if invalid
  - Calculate import size for quota check
  - Call Config.remove_all() to clear existing rules
  - Check import size against storage quota (102,400 bytes)
  - Iterate imported rules and create RuleConfig instances
  - Generate ID if missing (rule_timestamp_random)
  - Call ruleConfig.save() for each rule
  - Return {success, importedCount, errors, warnings} object

- [ ] T010 [P] [US2] Add import UI section to jira/options.html in export-import-controls div
  - Add import-section div with border-top separator
  - Add file input with id="import-file-input" and accept=".json"
  - Add import mode radio buttons (replace/merge) with replace checked by default
  - Add "Import Rules" button with id="import-rules-btn"
  - Add import-status div for feedback messages

- [ ] T011 [P] [US2] Style import UI controls in jira/css/options.css
  - Style #import-section (margin-top, padding-top, border-top)
  - Style file input display
  - Style #import-mode-selection radio buttons (vertical layout)
  - Style #import-rules-btn (green background, white text, hover effect)
  - Style #import-status with loading/success/error color classes

- [ ] T012 [US2] Wire import button and add confirmation dialog in jira/js/options.js
  - Add import_rules to this.buttons object
  - Add event listener in init_listeners()
  - Implement getCurrentRules() helper to get current rule count
  - Show confirmation dialog for replace mode (warn about data loss)
  - Call ExportImport.importRules() with file and mode
  - Implement showImportStatus() helper for feedback
  - Display errors in alert dialog if import fails
  - Reload page after successful import to show new rules

**Checkpoint**: User Story 2 complete - import replace functionality fully operational and independently testable

---

## Phase 5: User Story 3 - Import Rules (Merge) (Priority: P3)

**Goal**: User can import rules and merge with existing configuration (no data loss)

**Independent Test**: Create 2 rules, import file with 3 rules using merge, verify 5 total rules coexist

### Implementation for User Story 3

- [ ] T013 [US3] Implement merge mode logic in ExportImport.importRules() in jira/js/export-import.js
  - Add else-if branch for mode === 'merge' (after replace mode)
  - Call Config.get_all() to retrieve existing rules
  - Build set of existing rule IDs for conflict detection
  - Calculate combined size (current + import) for quota check
  - For each imported rule: check if ID exists in existingIds set
  - If ID conflict detected: generate new unique ID (rule_timestamp_random)
  - Track ID conflicts in warnings array for user feedback
  - Create RuleConfig instances with resolved IDs
  - Call ruleConfig.save() for each imported rule
  - Return success with warnings about ID conflicts

**Checkpoint**: User Story 3 complete - merge functionality allows combining rule sets without data loss

---

## Phase 6: User Story 4 - Edit Exported Rules with Scripts (Priority: P4)

**Goal**: Enable power users to edit exported files with text editors and scripts, then re-import successfully

**Independent Test**: Export rule, duplicate with find/replace in text editor, import modified file, verify all rules functional

### Implementation for User Story 4

- [ ] T014 [US4] Enhance validation error messages in ExportImport.validateExportFile() in jira/js/export-import.js
  - Add line number hints to "missing field" errors (estimate from rule index)
  - Add regex error hints for common mistakes (unterminated character class, unmatched parentheses)
  - Include field name and rule name in all error messages for easy debugging
  - Format error messages to be actionable (suggest fixes where possible)

**Checkpoint**: User Story 4 complete - validation provides clear guidance for manual file editing

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final improvements affecting multiple user stories

- [ ] T015 [P] Add script tag for export-import.js to jira/options.html if not already added
- [ ] T016 [P] Manual cross-browser testing on Chrome, Edge, Brave
- [ ] T017 Test edge cases: 0 rules export, 1000+ rules import, unicode characters, syntax errors
- [ ] T018 Test round-trip lossless: export then immediate import, verify all fields preserved
- [ ] T019 Update jira/manifest.json version number (increment minor version)
- [ ] T020 Run build.sh to create release ZIP and verify extension loads in chrome://extensions

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: N/A - no blocking prerequisites needed
- **User Story 1 (Phase 3)**: Depends on Setup - can start immediately after T001-T003
- **User Story 2 (Phase 4)**: Depends on User Story 1 completion (needs export format defined)
- **User Story 3 (Phase 5)**: Depends on User Story 2 completion (extends import functionality)
- **User Story 4 (Phase 6)**: Depends on User Story 2 completion (enhances validation)
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Independent - can start after Setup (Phase 1)
- **User Story 2 (P2)**: Depends on US1 (imports use export file format)
- **User Story 3 (P3)**: Depends on US2 (extends importRules method)
- **User Story 4 (P4)**: Depends on US2 (enhances validateExportFile method)

**Recommended Execution**: Sequential by priority (P1 → P2 → P3 → P4) for MVP focus

### Within Each User Story

- Tasks marked [P] can run in parallel (different files, no conflicts)
- UI tasks (HTML/CSS) can run in parallel with implementation tasks
- Event handler wiring (options.js) must wait for UI and implementation to complete
- Testing happens after story implementation is complete

### Parallel Opportunities

- **Setup tasks**: T001-T003 are sequential (T002 depends on T001)
- **User Story 1**: T004 (JS), T005 (HTML), T006 (CSS) can run in parallel, then T007 integrates
- **User Story 2**: T008 and T009 are sequential (T009 uses T008), T010 and T011 can run in parallel, T012 integrates all
- **User Story 3**: T013 is single task (extends T009)
- **User Story 4**: T014 is single task (enhances T008)

---

## Parallel Example: User Story 1

```bash
# These can run in parallel:
# Developer A:
Task T004: Implement exportRules() method in export-import.js

# Developer B (parallel):
Task T005: Add export UI to options.html
Task T006: Style export UI in options.css

# After T004-T006 complete:
Task T007: Wire export button in options.js (integrates all)
```

---

## Parallel Example: User Story 2

```bash
# Sequential (validation needed first):
Task T008: Implement validateExportFile() in export-import.js
Task T009: Implement importRules() in export-import.js (uses T008)

# These can run in parallel while T008/T009 in progress:
Task T010: Add import UI to options.html
Task T011: Style import UI in options.css

# After all complete:
Task T012: Wire import button in options.js (integrates all)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 3: User Story 1 (T004-T007)
3. **STOP and VALIDATE**: Test export with 0 rules, 3 rules, 100 rules
4. Verify exported files are valid JSON and editable in text editors
5. Deploy/demo export-only feature (backup use case)

### Incremental Delivery (Recommended)

1. Complete Setup (Phase 1)
2. Add User Story 1 → Test independently → Deploy (export/backup capability)
3. Add User Story 2 → Test independently → Deploy (basic import/sharing)
4. Add User Story 3 → Test independently → Deploy (merge for power users)
5. Add User Story 4 → Test independently → Deploy (enhanced error messages)
6. Each story adds value without breaking previous functionality

### Parallel Team Strategy

With 2 developers:

1. Both complete Setup together (Phase 1)
2. User Story 1:
   - Developer A: T004 (export logic)
   - Developer B: T005-T006 (UI)
   - Both sync for T007 (integration)
3. User Story 2:
   - Developer A: T008-T009 (validation + import logic)
   - Developer B: T010-T011 (UI)
   - Both sync for T012 (integration)
4. User Story 3: Either developer (T013)
5. User Story 4: Either developer (T014)

---

## Notes

- [P] tasks = different files, can run in parallel
- [Story] label maps task to specific user story for traceability
- No automated tests - manual testing checklist in quickstart.md
- Each user story is independently testable and deliverable
- Merge conflicts are auto-resolved (no manual UI needed)
- File format versioning supports future extensions
- Storage quota validation prevents corrupted imports
- Error messages designed for text editor debugging
- Commit after completing each user story phase
- Avoid: same-file conflicts, cross-story dependencies that prevent independent delivery

---

## Task Summary

**Total Tasks**: 20
- Phase 1 (Setup): 3 tasks
- Phase 2 (Foundational): 0 tasks (no blocking prerequisites)
- Phase 3 (US1 - Export): 4 tasks
- Phase 4 (US2 - Import Replace): 5 tasks
- Phase 5 (US3 - Import Merge): 1 task
- Phase 6 (US4 - Script Editing): 1 task
- Phase 7 (Polish): 6 tasks

**Parallel Opportunities**: 6 tasks marked [P] across user stories

**MVP Scope** (Recommended): Phase 1 + Phase 3 (7 tasks total) delivers basic export functionality for backup use case

**Full Feature**: All 20 tasks deliver complete export/import with merge and script editing support
