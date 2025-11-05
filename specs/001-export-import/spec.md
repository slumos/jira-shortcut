# Feature Specification: Rule Export and Import

**Feature Branch**: `001-export-import`
**Created**: 2025-10-08
**Status**: Draft
**Input**: User description: "Add support for export and input of user-configured rules. Export should be in a format that is easy to share to other users to import into their own configuration and easy to edit with a text editor for making changes with find and replace, or generating new rules with scripts, etc."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Export All Rules (Priority: P1)

A user has configured multiple custom rules for their JIRA instance and wants to back them up or share them with teammates. They navigate to the Options page and export all their rules to a file that can be saved, shared via email/Slack, or checked into version control.

**Why this priority**: Core value proposition - enables rule sharing and backup, which is the primary use case. Without export, import is useless.

**Independent Test**: Can be fully tested by creating rules, clicking an export button, and verifying a file is downloaded with all rule configurations in human-readable format.

**Acceptance Scenarios**:

1. **Given** a user has 3 configured rules, **When** they click "Export Rules" on the Options page, **Then** a file is downloaded containing all 3 rules in a text-editable format
2. **Given** a user has no configured rules, **When** they click "Export Rules", **Then** a file is downloaded with an empty rules collection (not an error)
3. **Given** a user has exported their rules, **When** they open the file in a text editor, **Then** they can read and understand the rule structure without technical expertise

---

### User Story 2 - Import Rules (Replace) (Priority: P2)

A user receives a rule configuration file from a teammate and wants to import it into their extension. They navigate to the Options page, select the import file, and choose to replace their existing rules with the imported ones.

**Why this priority**: Completes the sharing workflow - enables users to adopt shared configurations. Replace mode is simpler and covers the "fresh start" use case.

**Independent Test**: Can be tested by exporting rules from one browser profile, importing into another profile with "replace" option, and verifying the imported rules work correctly.

**Acceptance Scenarios**:

1. **Given** a user has a valid rules export file, **When** they import it with "replace existing rules" option, **Then** all previous rules are removed and the imported rules are active
2. **Given** a user imports a file with invalid format, **When** the import is attempted, **Then** an error message is shown and no rules are changed
3. **Given** a user imports a file successfully, **When** they return to the Options page, **Then** they see all imported rules displayed correctly

---

### User Story 3 - Import Rules (Merge) (Priority: P3)

A user has existing rules and wants to add new rules from a shared file without losing their current configuration. They import the file with a "merge" option that adds imported rules while keeping existing ones.

**Why this priority**: Enhancement for power users who maintain personal rules alongside team-shared rules. Less critical than basic import/export.

**Independent Test**: Can be tested by creating personal rules, importing a file with "merge" option, and verifying both old and new rules coexist.

**Acceptance Scenarios**:

1. **Given** a user has 2 existing rules and imports a file with 3 rules using "merge", **When** import completes, **Then** they have 5 total rules (2 original + 3 imported)
2. **Given** a user imports rules that have duplicate names to existing rules, **When** merge is performed, **Then** imported rules are added with unique identifiers to avoid conflicts
3. **Given** a user merges rules, **When** they view the Options page, **Then** they can distinguish between originally configured rules and imported rules

---

### User Story 4 - Edit Exported Rules with Scripts (Priority: P4)

A power user needs to generate 50 rules for different JIRA projects with similar patterns. They export a template rule, use a script (or text editor find/replace) to generate variations, and import the modified file.

**Why this priority**: Addresses the "easy to edit with text editor" and "generating new rules with scripts" requirements. Valuable for power users but not essential for basic sharing.

**Independent Test**: Can be tested by exporting one rule, duplicating it in a text editor with modified values, importing the edited file, and verifying all generated rules work correctly.

**Acceptance Scenarios**:

1. **Given** a user exports a rule file, **When** they duplicate entries and modify values using find/replace in a text editor, **Then** the modified file imports successfully with all new rules
2. **Given** a user generates 50 rule variations via script, **When** they import the file, **Then** all 50 rules are created and functional
3. **Given** a user makes a syntax error while editing the export file, **When** they attempt to import, **Then** they receive a clear error message indicating the line/location of the problem

---

### Edge Cases

- What happens when importing a file exported from a future version of the extension with unknown fields?
- How does the system handle very large export files (e.g., 1000+ rules)?
- What happens if a user tries to import a file that's not in the expected format (e.g., a random text file)?
- How does the system handle special characters or unicode in rule names/patterns during export/import?
- What happens if import fails mid-process (e.g., browser crash, storage quota exceeded)?
- How does the system handle rules with identical names or IDs during merge?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide an "Export Rules" action on the Options page that downloads all configured rules to a file
- **FR-002**: System MUST export rules in a text-based format that is human-readable and editable in standard text editors
- **FR-003**: System MUST provide an "Import Rules" action on the Options page that accepts a file and loads rules from it
- **FR-004**: System MUST offer two import modes: "Replace existing rules" and "Merge with existing rules"
- **FR-005**: System MUST validate imported file format and display clear error messages for invalid files
- **FR-006**: System MUST preserve all rule properties during export/import (name, url_pattern, title_pattern, out_pattern, test_url, test_title)
- **FR-007**: Exported files MUST be portable across different browsers and operating systems
- **FR-008**: System MUST handle conflicts during merge by ensuring imported rules have unique identifiers
- **FR-009**: System MUST provide user confirmation before replacing existing rules during import
- **FR-010**: System MUST support batch editing workflows where users can modify exported files with find/replace or scripts
- **FR-011**: System MUST include format version information in exported files to support future compatibility
- **FR-012**: Imported rules MUST be immediately functional without requiring browser restart or extension reload

### Assumptions

- **A-001**: Export format will be JSON (most common for structured data, human-readable, scriptable)
- **A-002**: File extension will be `.json` with a descriptive naming pattern like `jira-shortcut-rules-YYYY-MM-DD.json`
- **A-003**: Import/export UI will be added to the existing Options page rather than creating a new page
- **A-004**: File size limits will follow browser download/upload constraints (typically hundreds of MB, sufficient for rule configurations)
- **A-005**: Users understand basic file operations (download, save, upload) - no in-app file management needed
- **A-006**: Error messages can reference JSON terminology (e.g., "invalid JSON syntax") since the format is documented
- **A-007**: Merge conflict resolution will be automatic (no manual conflict resolution UI for MVP)

### Key Entities

- **Rule Export File**: A text file containing one or more rule configurations, including metadata (format version, export timestamp, extension version) and an array of rule objects with all their properties
- **Rule Configuration**: The complete definition of a rule including name, patterns, test data, and unique identifier
- **Import Operation**: A user-initiated action that processes an export file and applies rules to storage, with a mode flag (replace/merge) and validation results

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can export all their rules and import them into another browser profile within 30 seconds
- **SC-002**: Exported files can be opened, edited, and saved in any standard text editor (Notepad, VS Code, vim) without corruption
- **SC-003**: Users can successfully share rule configurations via common methods (email, Slack, file sharing) and recipients can import without assistance
- **SC-004**: 95% of valid export files import successfully on the first attempt without errors
- **SC-005**: Users can use find/replace operations in text editors to modify exported rules and re-import successfully
- **SC-006**: Import validation provides actionable error messages that allow users to fix file problems within one retry
- **SC-007**: Zero data loss during export/import cycle - all rule properties are preserved exactly

### Assumptions on Success Measurement

- **A-008**: Success can be measured through manual testing and user feedback in first release (no usage telemetry built into extension)
- **A-009**: "Standard text editor" is defined as any UTF-8 compatible text editor on Windows, macOS, or Linux
- **A-010**: "Actionable error message" means message includes the specific problem location and suggests how to fix it
