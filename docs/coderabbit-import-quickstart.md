# CodeRabbit Import - Quick Start Guide

Get started with importing CodeRabbit reviews in 5 minutes.

## Prerequisites Checklist

- [ ] Using Cursor IDE (not VS Code)
- [ ] CodeRabbit extension installed
- [ ] At least one CodeRabbit review completed
- [ ] Workspace is a Git repository

## Step 1: Configure URL Settings

Choose one option:

### Option A: Custom URL (Recommended)

Open VS Code settings and add:

**For GitLab:**
```json
{
  "code-review.customUrl": "https://gitlab.com/YOUR-ORG/YOUR-REPO/-/blob/{sha}/{file}#L{start}-{end}"
}
```

**For GitHub:**
```json
{
  "code-review.customUrl": "https://github.com/YOUR-ORG/YOUR-REPO/blob/{sha}/{file}#L{start}-L{end}"
}
```

### Option B: Base URL (Simple)

```json
{
  "code-review.baseUrl": "https://github.com/YOUR-ORG/YOUR-REPO/blob"
}
```

## Step 2: Run Import Command

1. Open Command Palette: `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (macOS)
2. Type: `Code Review: Import from CodeRabbit`
3. Press Enter

## Step 3: Configure Filters

### First Time Import (Get Everything)

- **Branch**: Select "All branches"
- **Start Date**: Leave empty
- **End Date**: Leave empty
- **Latest Review Only**: Unchecked

### Regular Updates (Get Latest Only)

- **Branch**: Select your current branch or "All branches"
- **Start Date**: Leave empty
- **End Date**: Leave empty
- **Latest Review Only**: ✓ Checked

### Specific Date Range

- **Branch**: Select "All branches" or specific branch
- **Start Date**: `2024-01-01` (example)
- **End Date**: `2024-12-31` (example)
- **Latest Review Only**: Unchecked

## Step 4: Review Results

The extension will show:
- ✓ Reviews processed
- ✓ Comments imported
- ⊘ Comments skipped (duplicates, resolved, invalid)

## Common Issues & Quick Fixes

### "Database not found"
→ Make sure you're in Cursor IDE and have run a CodeRabbit review

### "Invalid URL configuration"
→ Add `code-review.customUrl` or `code-review.baseUrl` to settings

### "0 comments imported"
→ Try "All branches" filter and remove date restrictions

### Links don't work
→ Check your URL configuration matches your Git hosting provider

## Next Steps

1. Open the Comment Explorer sidebar
2. Review imported comments
3. Add your own manual comments
4. Export combined report

## Need More Help?

See the [full CodeRabbit Import Guide](./coderabbit-import-guide.md) for detailed troubleshooting and advanced usage.
