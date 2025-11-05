<!--
Sync Impact Report - Constitution Creation
Version: 1.0.0 (Initial creation)
Created: 2025-10-07

Modified Principles: N/A (initial version)
Added Sections: All (initial version)
Removed Sections: None

Templates Status:
✅ plan-template.md - Reviewed, Constitution Check section exists
✅ spec-template.md - Reviewed, user stories and requirements align
✅ tasks-template.md - Reviewed, testing and phase structure align
⚠ commands/*.md - No command files found, no updates needed

Follow-up TODOs: None
-->

# JIRA ShortCut Constitution

## Core Principles

### I. Simplicity First

The extension MUST remain lightweight and focused on its core purpose: copying JIRA issue references to the clipboard. Features MUST be evaluated against complexity cost. No feature that duplicates existing JIRA functionality shall be added unless it significantly improves the copy-to-clipboard workflow.

**Rationale**: Chrome extensions that bloat with features suffer from performance issues, increased maintenance burden, and user confusion. Users choose this extension for speed and simplicity.

### II. Browser Compatibility

The extension MUST work across all Chromium-based browsers (Chrome, Edge, Brave, Arc). Manifest V3 compliance is NON-NEGOTIABLE. All permissions MUST be justified and minimal. No excessive permissions that trigger browser warnings.

**Rationale**: Privacy and security are paramount for browser extensions. Unnecessary permissions reduce user trust and can cause rejection from extension stores.

### III. Non-Intrusive Operation

The extension MUST NOT interfere with JIRA's native functionality. It operates via keyboard shortcuts and browser action only. No content script injection into JIRA pages unless absolutely necessary. No modification of DOM unless for reading issue data.

**Rationale**: JIRA instances vary widely in configuration and customization. Intrusive modifications can break functionality or conflict with enterprise JIRA customizations.

### IV. Keyboard-First Interaction

All primary workflows MUST be accessible via keyboard shortcuts. Default shortcut is `Ctrl+J` (customizable). The extension MUST provide visual feedback for copy operations. No multi-step workflows requiring multiple clicks.

**Rationale**: Developer users prioritize keyboard efficiency. The extension's value proposition is speed—multi-step interactions defeat this purpose.

### V. Configuration Storage Reliability

User preferences MUST persist using Chrome Storage API (`chrome.storage.sync` for cross-device settings, `chrome.storage.local` for device-specific). Settings MUST have sensible defaults. No data loss on extension updates.

**Rationale**: Users configure patterns and preferences; losing these on updates creates a poor experience and support burden.

## Testing & Quality Standards

### Manual Testing Requirements

- **Cross-Browser Testing**: Changes MUST be validated with browser-based testing
- **JIRA Compatibility**: Test against both cloud JIRA
- **Keyboard Shortcut Testing**: Verify shortcuts work and do not conflict with browser/OS shortcuts
- **Permissions Validation**: Review permissions needed after every change to minimize scope

### Release Quality Gates

Before publishing to Chrome Web Store:
1. Extension MUST load without errors in `chrome://extensions` developer mode
2. Icon and metadata MUST be present and correct
3. All permissions MUST be documented in the store description
4. Version number MUST be incremented according to semantic versioning

## Browser Extension Constraints

### Manifest Requirements

- **Manifest Version**: V3 only (V2 deprecated)
- **Permissions**: Explicitly document each permission in README
- **Service Worker**: Background scripts MUST use service worker pattern (no persistent background pages)
- **Content Security Policy**: No inline scripts, no eval(), no remote code execution

### Distribution

- **Packaging**: Use `build.sh` to create release ZIP
- **Store Listing**: Version in manifest.json MUST match store version before release
- **Update Strategy**: Incremental updates preferred over major rewrites to maintain user trust

## Governance

### Amendment Procedure

1. Proposed amendments MUST be documented in a commit message or issue
2. Breaking changes require MAJOR version bump of constitution
3. New principles or standards require MINOR version bump
4. Clarifications and typo fixes require PATCH version bump

### Compliance

- All feature specifications MUST reference applicable constitution principles
- Pull requests MUST include a brief constitution compliance statement if adding features
- Simplicity violations (adding complexity) MUST be explicitly justified in plan.md Complexity Tracking section
- Template updates MUST be synchronized when principles change

### Versioning Policy

Constitution follows semantic versioning:
- **MAJOR**: Removal or redefinition of core principles that invalidate prior work
- **MINOR**: Addition of new principles or expansion of existing guidance
- **PATCH**: Clarifications, typo fixes, non-semantic improvements

**Version**: 1.0.0 | **Ratified**: 2025-10-07 | **Last Amended**: 2025-10-07
