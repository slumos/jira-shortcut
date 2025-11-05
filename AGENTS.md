# JIRA ShortCut - Agent Reference

**Purpose**: Technical reference for AI agents and human developers working on the JIRA ShortCut Chrome extension. Establishes common terminology and describes architecture for feature development.

**Audience**: Expert software engineers and AI coding agents familiar with Chrome extension development, JavaScript, and web APIs.

---

## Project Overview

**JIRA ShortCut** is a Manifest V3 Chrome extension that copies JIRA issue references (and other ticket systems) to the clipboard in customizable formats. Users configure pattern-based **Rules** that match URLs and extract data from page titles to generate formatted output.

**Core Value Proposition**: One-click (or `Ctrl+J` keyboard shortcut) to copy issue references in formats like Markdown, HTML, or Slack-compatible text without navigating JIRA's UI.

**Architecture Pattern**: Browser action popup with pattern-based text transformation. No content script injection—all data extraction happens from the active tab's URL and title via Chrome APIs.

---

## Key Terminology

### Rule (aka "Configuration Rule" or "Pattern Rule")

A **Rule** is a user-defined configuration object that specifies:
- **Name**: Display label for the rule (e.g., "Email", "Markdown", "Slack")
- **URL Pattern**: Regex to match against the active tab's URL (e.g., `(jira|tickets)*/browse/`)
- **Title Pattern**: Regex with capture groups to extract data from the page title (e.g., `^\[#?([^\]]+)\](.*)( -[^-]+)$`)
- **Output Pattern**: Template string using capture group references (`$1`, `$2`) and special tokens (`$url`, `$url_base`, `$html:`) to format the clipboard content

**Storage**: Rules are persisted in `chrome.storage.sync` with auto-generated IDs like `rule_1234567890`.

**Example Rule** (Email format):
```javascript
{
  name: "Email",
  url_pattern: "(jira|tickets)*/browse/",
  title_pattern: "^\\[#?([^\\]]+)\\](.*)( -[^-]+)$",
  out_pattern: "$html:<a href=\"$url\">$1:$2</a>"
}
```

For a JIRA page with:
- URL: `https://issues.apache.org/jira/browse/HADOOP-3629`
- Title: `[HADOOP-3629] Document the metrics produced by hadoop - JIRA`

This rule produces: `<a href="https://issues.apache.org/jira/browse/HADOOP-3629">HADOOP-3629: Document the metrics produced by hadoop</a>`

### Default Rules (aka "Rule Templates")

The extension ships with 6 **Default Rules** defined in `config.js` (`RuleConfig.defaults`):
1. `email` - HTML anchor tag with issue key and description
2. `email_short` - HTML anchor tag with issue key only
3. `markdown` - Markdown link with issue key and description
4. `markdown_short` - Markdown link with issue key only
5. `custom_v1_jira_slack` - Slack-formatted link for JIRA
6. `custom_v1_github_slack` - Slack-formatted link for GitHub PRs

Users can reset rules to these defaults via the Options page.

### Output Pattern Special Tokens

- `$url` - Full page URL
- `$url_base` - URL before the first `?` character
- `$html:` - Prefix indicating the output contains HTML (bypasses HTML escaping)
- `$1`, `$2`, `$N` - Regex capture group references from the title pattern

### BgConfig (Background Configuration)

Global configuration object (`BgConfig`) in `config.js` that:
- Loads all rules from `chrome.storage.sync` on extension startup
- Provides `match(url)` to check if any rule matches a URL (used by service worker to enable/disable the browser action)
- Provides `apply(url, title)` to generate output for all matching rules

### Rule Matching & Application Flow

1. **Service Worker** (`service_worker.js`): Listens to `chrome.tabs.onUpdated`, calls `BgConfig.match(tab.url)` to enable/disable the browser action icon
2. **Popup** (`popup.js`): When opened, queries the active tab, calls `BgConfig.apply(tab.url, tab.title)` to generate output for all matching rules
3. **Auto-Copy**: The first matching rule's output is automatically copied to the clipboard when the popup opens
4. **Manual Selection**: Additional rule buttons are displayed if multiple rules match, allowing users to click for alternate formats

---

## Architecture & File Structure

### Extension Directory: `jira/`

```
jira/
├── manifest.json          # Manifest V3 configuration
├── icon.png               # Extension icon
├── popup.html             # Browser action popup UI
├── options.html           # Extension options/settings page
├── css/
│   ├── popup.css          # Popup styling
│   └── options.css        # Options page styling
└── js/
    ├── service_worker.js  # Background service worker (enables/disables action)
    ├── config.js          # Config/BgConfig/RuleConfig classes
    ├── popup.js           # Popup UI logic and clipboard operations
    ├── options.js         # Options page controller (Options class)
    └── rule.js            # Options page rule editor (Rule class)
```

### Core JavaScript Modules

#### `config.js`

**Exports**: `Config`, `BgConfig`, `RuleConfig`

- **`Config`**: Thin wrapper around `chrome.storage.sync` with `get()`, `set()`, `remove()`, `get_all()`, `remove_all()`
- **`BgConfig`**: Singleton that loads all rules and provides `match(url)` and `apply(url, title)`
- **`RuleConfig`**: Rule object with pattern matching (`match(url)`) and output generation (`apply(url, title)`)

**Key Methods**:
- `RuleConfig.apply(url, title)`: Applies title pattern regex to title, substitutes capture groups and special tokens into output pattern, escapes HTML unless `$html:` prefix is present
- `BgConfig.init(callback)`: Loads all rules from storage, calls callback when complete

#### `service_worker.js`

Listens to `chrome.tabs.onUpdated` and enables/disables the browser action based on `BgConfig.match(tab.url)`. Uses `importScripts('config.js')` to load configuration module.

#### `popup.js`

**Key Function**: `popupInit(bgConfig)`
- Queries active tab via `chrome.tabs.query`
- Calls `BgConfig.apply(tab.url, tab.title)` to get all matching rules
- Auto-copies first rule's output via `doCopy()`
- Renders additional rule buttons for manual selection

**Clipboard Mechanism**: `doCopy(data, close)`
- Creates a hidden `contentEditable` div (`#copy-clip-div`)
- Sets `innerHTML` to the formatted output
- Uses legacy `document.execCommand('Copy')` (Manifest V3 compatible via `clipboardWrite` permission)

#### `options.js`

**Exports**: `Options` class

Manages the Options page:
- Clones rule form template for each saved rule
- Instantiates `Rule` objects for each rule
- Handles "Add rule" and "Delete all rules" actions

#### `rule.js`

**Exports**: `Rule` class

Manages a single rule editor form:
- Binds form fields to `RuleConfig` instance
- Real-time validation: tests URL pattern against test URL, displays result
- Real-time preview: applies patterns to test inputs, displays formatted output
- Save/Load/Remove actions via `RuleConfig` methods
- Reset buttons to load default rule templates

---

## Key Behaviors & Constraints

### URL Matching

- Rules use JavaScript `RegExp` with the `url_pattern` field
- Service worker checks `BgConfig.match(url)` on every tab update
- Browser action is **disabled** (greyed out) on pages that don't match any rule
- Multiple rules can match the same URL (all matching rules are displayed in popup)

### Clipboard Operations

- **Auto-copy on popup open**: First matching rule is automatically copied
- **Manual copy**: User can click buttons to copy alternate formats
- **Close behavior**: Popup closes after copy unless `close=false` parameter is passed
- **HTML support**: Rules with `$html:` prefix output HTML (useful for rich email clients)
- **Keyboard support**: First rule button is auto-focused for keyboard navigation

### Storage & Persistence

- Rules stored in `chrome.storage.sync` (synced across devices)
- Rule IDs are auto-generated timestamps: `rule_1234567890`
- No default rules are created automatically—users must configure manually or reset to defaults
- Options page loads all rules on init via `Config.get_all()`

### Security & Content Policy

- **No content scripts**: All data extraction from tab URL/title via `chrome.tabs.query`
- **No inline scripts**: All JS external references
- **No `eval()`**: Safe regex-based pattern matching
- **HTML escaping**: `escape_html()` in `config.js` sanitizes output unless `$html:` is used
- **Permissions**: `tabs` (read URL/title), `clipboardWrite`, `storage` (all justified, minimal)

### Pattern Matching Edge Cases

- **URL pattern matching**: Plain string match via `RegExp.test()` (not anchored by default—use `^` and `$` if needed)
- **Title pattern capture groups**: Uses `String.replace()` with regex—capture groups map to `$1`, `$2`, etc.
- **Invalid patterns**: Stored as-is, may cause runtime errors (no validation on save)
- **Special characters in output**: `$url` and `$url_base` replaced first, then capture groups (order matters for escaping)

---

## Common Development Patterns

### Adding a New Default Rule Template

1. Add to `RuleConfig.defaults` in `config.js`:
   ```javascript
   new_template_name: {
     name: "Display Name",
     test_url: 'https://example.com/test',
     test_title: 'Example [TEST-123] Title',
     url_pattern: 'example\\.com',
     title_pattern: '\\[([^\\]]+)\\]',
     out_pattern: '$1 - $url'
   }
   ```
2. Add reset button to `options.html`:
   ```html
   <button type='button' data-id="reset-new_template_name">New Template</button>
   ```
3. Add button listener in `rule.js` (`Rule.buttons` and `Rule.init_listeners`)

### Extending Pattern Syntax

Current special tokens (`$url`, `$url_base`, `$html:`) are hardcoded in `RuleConfig.apply()`. To add new tokens:

1. Define replacement logic in `RuleConfig.apply()`
2. Document in `RuleConfig.defaults` test examples
3. Update Options page hints/instructions

**Example**: Adding `$domain` token:
```javascript
// In RuleConfig.apply()
var url_domain = new URL(url).hostname;
out_pattern = out_pattern.replace(/\$domain/g, url_domain);
```

### Testing a Rule

Use the Options page's built-in tester:
- **Test URL**: Target page URL
- **Test Title**: Page title (view via `document.title` in DevTools)
- **Real-time validation**: Green/red indicator for URL pattern match
- **Real-time preview**: Formatted output displayed in "Result" field

---

## Extension Lifecycle

1. **Install/Update**: Service worker loads, `BgConfig.init()` called, rules loaded from storage
2. **Tab Navigation**: `chrome.tabs.onUpdated` fires → `checkForValidUrl()` → enable/disable action
3. **Popup Open**: `popupInit()` → query active tab → `BgConfig.apply()` → auto-copy first rule → render buttons
4. **User Interaction**: Click rule button → `doCopy()` → clipboard write → popup closes

---

## Known Limitations & Technical Debt

### Legacy Clipboard API

Uses `document.execCommand('Copy')` instead of modern `navigator.clipboard.write()`:
- **Why**: Simpler implementation, works with HTML content
- **Risk**: Deprecated API (but still widely supported in Chrome)
- **Migration Path**: Switch to `navigator.clipboard.write()` with `ClipboardItem` for HTML

### No Rule Validation

Rules are saved without validation:
- Invalid regex patterns cause runtime errors in popup
- No UI feedback for invalid patterns until rule is used
- **Improvement**: Add regex validation in `rule.js` before save

### Service Worker importScripts

Uses `importScripts('config.js')` to load config module:
- **Why**: Simple module loading for service workers
- **Alternative**: ES modules in service workers (requires `"type": "module"` in manifest)

### No Error Handling for Tab Query

`chrome.tabs.query()` in `popup.js` assumes success:
- No fallback if active tab is unavailable
- No error message if no matching rules found (blank popup)

### HTML Injection via innerHTML

`popup.js` and `rule.js` use `innerHTML` for rendering:
- **Context**: User's own configuration data (not external input)
- **Risk**: Low (user can only harm themselves)
- **Best Practice**: Use `textContent` or DOM manipulation for non-HTML output

---

## Feature Development Workflow

When adding new features, consider:

1. **Simplicity First**: Does this add complexity? Can it be solved with existing patterns?
2. **Storage Impact**: Will this change the rule schema? Need migration logic?
3. **Manifest V3 Compliance**: Does this require new permissions? Is the API compatible?
4. **Cross-Browser Testing**: Test on Chrome, Edge, and Brave at minimum
5. **Backward Compatibility**: Will existing rules continue to work?

---

## Glossary

- **Browser Action**: Chrome extension UI triggered by toolbar icon click or keyboard shortcut
- **Service Worker**: Background script that runs in response to events (replaces persistent background pages in Manifest V3)
- **Content Script**: Script injected into web pages (NOT used in this extension)
- **chrome.storage.sync**: Storage API that syncs data across devices via Chrome Sync
- **Manifest V3**: Current Chrome extension platform (V2 deprecated as of 2024)
- **Pattern Rule**: See "Rule" above
- **Output Pattern**: Template string for formatted output (see "Rule" above)
- **Capture Group**: Regex parenthesized subexpression (e.g., `([A-Z]+-\d+)` captures "JIRA-123")

---

## References

- Chrome Extension Documentation: https://developer.chrome.com/docs/extensions/
- Manifest V3 Migration Guide: https://developer.chrome.com/docs/extensions/migrating/
- chrome.storage API: https://developer.chrome.com/docs/extensions/reference/storage/
- Regular Expressions (MDN): https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions

---

**Document Version**: 1.0.0
**Last Updated**: 2025-10-07
**Maintained By**: Project contributors and AI agents
