# CodeRabbit Import Guide

This guide provides detailed information about importing code review comments from CodeRabbit into the vscode-code-review extension.

## Overview

The CodeRabbit import feature allows you to seamlessly integrate AI-generated code review findings from CodeRabbit (when using Cursor IDE) into your manual code review workflow. This creates a unified view of all review comments, whether they come from AI analysis or human reviewers.

## Prerequisites

- **Cursor IDE**: CodeRabbit integration is currently only available in Cursor IDE
- **CodeRabbit Extension**: The CodeRabbit extension must be installed and have performed at least one code review
- **Git Repository**: Your workspace must be a Git repository
- **URL Configuration**: Either `code-review.baseUrl` or `code-review.customUrl` must be configured

## How It Works

### Data Source

CodeRabbit stores its review data in a SQLite database located in Cursor IDE's workspace storage:
- **Windows**: `%APPDATA%/Cursor/User/workspaceStorage/<workspace-hash>/state.vscdb`
- **macOS**: `~/Library/Application Support/Cursor/User/workspaceStorage/<workspace-hash>/state.vscdb`
- **Linux**: `~/.config/Cursor/User/workspaceStorage/<workspace-hash>/state.vscdb`

The extension automatically locates this database based on your current workspace.

### Import Process

1. **Database Discovery**: The extension calculates your workspace hash and locates the CodeRabbit database
2. **Review Extraction**: Reviews are read from the SQLite database and parsed from JSON format
3. **Filtering**: Reviews are filtered based on your criteria (branch, dates, latest only)
4. **Comment Processing**: Individual comments are extracted and filtered by resolution status
5. **Data Transformation**: CodeRabbit data is mapped to the extension's CSV format
6. **Git Integration**: Commit SHAs and file authors are retrieved using Git
7. **Deduplication**: Existing comments are checked to avoid duplicates
8. **CSV Update**: New comments are appended to your code-review.csv file

## Configuration

### URL Configuration Examples

#### GitLab with Custom URL (Recommended)

```json
{
  "code-review.customUrl": "https://gitlab.com/myorg/myrepo/-/blob/{sha}/{file}#L{start}-{end}"
}
```

This generates URLs like:
```
https://gitlab.com/myorg/myrepo/-/blob/a1b2c3d4/src/utils/helper.ts#L45-52
```

#### GitHub with Custom URL

```json
{
  "code-review.customUrl": "https://github.com/myorg/myrepo/blob/{sha}/{file}#L{start}-L{end}"
}
```

This generates URLs like:
```
https://github.com/myorg/myrepo/blob/a1b2c3d4/src/utils/helper.ts#L45-L52
```

#### GitLab with Base URL (Simple)

```json
{
  "code-review.baseUrl": "https://gitlab.com/myorg/myrepo/-/blob"
}
```

This generates URLs like:
```
https://gitlab.com/myorg/myrepo/-/blob/a1b2c3d4/src/utils/helper.ts#L45-L52
```

### Available Placeholders for Custom URL

- `{sha}`: Git commit SHA
- `{file}`: Relative file path
- `{start}`: Starting line number
- `{end}`: Ending line number

## Import Filters

### Branch Filter

Select which Git branch's reviews to import:
- **All branches**: Import reviews from all branches
- **Specific branch**: Import only reviews from the selected branch (e.g., `main`, `develop`, `feature/new-feature`)

### Date Range Filter

Filter reviews by their completion date:
- **Start Date**: Import only reviews completed on or after this date (ISO 8601 format: `YYYY-MM-DD`)
- **End Date**: Import only reviews completed on or before this date (ISO 8601 format: `YYYY-MM-DD`)
- Leave empty to not filter by date

### Latest Review Only

When enabled, imports only the most recent review that matches your other filter criteria. This is useful when you want to import findings from the latest code review session without including historical reviews.

## Data Mapping

### CodeRabbit to CSV Field Mapping

| CodeRabbit Field | CSV Field | Transformation |
|-----------------|-----------|----------------|
| `comment.id` | `id` | Direct copy (UUID) |
| `comment.filename` | `filename` | Direct copy |
| `comment.startLine`, `endLine` | `lines` | Format: `"startLine:0-endLine:0"` |
| `comment.comment` | `comment` | Text + suggestions + analysis |
| `comment.comment` (first line) | `title` | First line extracted |
| `comment.severity` | `priority` | critical→3, major→2, minor/trivial→1 |
| `comment.indicatorTypes[0]` | `category` | First indicator or "Unknown" |
| Git SHA | `sha` | Via `git blame` or current commit |
| Generated URL | `url` | Using customUrl or baseUrl |
| Git blame | `assignee` | Author of the line |
| - | `status` | Always "open" |

### Comment Text Formatting

The comment field combines multiple CodeRabbit data points:

1. **Main Comment**: The primary comment text from CodeRabbit
2. **Suggestions**: If CodeRabbit provided code suggestions, they're appended with a "Suggestions:" header
3. **Analysis**: If CodeRabbit provided detailed analysis, it's appended with an "Analysis:" header

Example:
```
This function has high cyclomatic complexity and should be refactored.

Suggestions:
	Extract the validation logic into a separate function
	Use early returns to reduce nesting

Analysis:
The function contains 5 nested if statements
Consider using a strategy pattern for different validation types
```

### Priority Mapping

CodeRabbit severity levels are mapped to the extension's 3-level priority system:

- **Critical** → Priority 3 (Red/High)
- **Major** → Priority 2 (Yellow/Medium)
- **Minor** → Priority 1 (Green/Low)
- **Trivial** → Priority 1 (Green/Low)

## Filtering Rules

### Automatic Exclusions

The following comments are automatically excluded from import:

1. **Resolved Comments**: Comments with resolution status:
   - `ignore`: User marked as "ignore"
   - `applySuggestion`: Suggestion was already applied
   - `fixWithAI`: Issue was fixed using AI

2. **Invalid Comments**:
   - Comments without a filename
   - Comments without comment text

3. **Duplicates**: Comments that were already imported (matched by ID)

### Why Comments Are Skipped

The import statistics show different skip reasons:

- **Skipped (no file)**: Comment doesn't reference a specific file
- **Skipped (no message)**: Comment has no text content
- **Skipped (resolved)**: Comment was marked as resolved in CodeRabbit
- **Skipped (duplicate)**: Comment was already imported previously

## Troubleshooting

### Database Not Found

**Problem**: "CodeRabbit database not found" error

**Solutions**:
1. Verify you're using Cursor IDE (not VS Code)
2. Ensure CodeRabbit extension is installed in Cursor
3. Run at least one CodeRabbit review in your workspace
4. Check that the workspace storage directory exists:
   - Windows: `%APPDATA%/Cursor/User/workspaceStorage/`
   - macOS: `~/Library/Application Support/Cursor/User/workspaceStorage/`
   - Linux: `~/.config/Cursor/User/workspaceStorage/`

### Invalid URL Configuration

**Problem**: "Invalid URL configuration" error

**Solutions**:
1. Configure either `code-review.baseUrl` or `code-review.customUrl` in VS Code settings
2. Ensure the URL starts with `http://` or `https://`
3. For custom URLs, verify placeholder syntax: `{sha}`, `{file}`, `{start}`, `{end}`

Example configuration:
```json
{
  "code-review.customUrl": "https://gitlab.com/org/repo/-/blob/{sha}/{file}#L{start}-{end}"
}
```

### No Comments Imported

**Problem**: Import completes but shows 0 comments imported

**Possible Causes**:

1. **Overly Restrictive Filters**:
   - Try selecting "All branches" instead of a specific branch
   - Remove date range filters
   - Disable "Latest review only"

2. **All Comments Already Imported**:
   - Check the "Skipped (duplicate)" count in import statistics
   - Comments are identified by their unique ID

3. **All Comments Resolved**:
   - Check the "Skipped (resolved)" count
   - CodeRabbit comments marked as ignored or fixed are not imported

4. **No Valid Comments**:
   - Check "Skipped (no file)" and "Skipped (no message)" counts
   - Some CodeRabbit comments might not have file associations

### Git SHA Errors

**Problem**: Warnings about Git SHA retrieval failures

**Impact**: The extension will use the current commit's SHA as a fallback, so links will still work but might not point to the exact commit where the issue was introduced.

**Solutions**:
1. Ensure your workspace is a valid Git repository
2. Verify Git is installed and accessible from the command line
3. Check that the files referenced in comments exist in your repository
4. For deleted files, the current commit SHA will be used

### Missing File References

**Problem**: Some comments don't appear or show incorrect file paths

**Solutions**:
1. Ensure files haven't been moved or renamed since the CodeRabbit review
2. Check that your workspace root matches the repository root
3. Verify the Git working directory is correctly configured

### Performance Issues

**Problem**: Import takes a long time or appears to hang

**Typical Causes**:
- Large number of reviews in the database
- Many files requiring Git operations
- Network-mounted workspace directories

**Solutions**:
1. Use more restrictive filters (specific branch, date range, latest only)
2. Ensure your workspace is on a local drive
3. Close other resource-intensive applications
4. For very large repositories, consider importing in smaller batches using date filters

## Best Practices

### Regular Imports

- Import CodeRabbit findings regularly to keep your review file up-to-date
- Use "Latest review only" for incremental imports
- Review and triage imported comments promptly

### Filter Strategy

- **Initial Import**: Use "All branches" and no date filters to import all historical reviews
- **Incremental Updates**: Use "Latest review only" to import just the newest findings
- **Branch-Specific**: Filter by branch when working on feature branches

### URL Configuration

- Use `customUrl` for maximum flexibility and correct link formatting
- Test your URL configuration by clicking on imported comment links
- Different repository hosts (GitLab, GitHub, Bitbucket) have different URL formats

### Workflow Integration

1. Run CodeRabbit review in Cursor IDE
2. Import findings using this extension
3. Review and prioritize imported comments
4. Add your own manual review comments
5. Export combined report for stakeholders

## Limitations

- **Cursor IDE Only**: CodeRabbit database format is specific to Cursor IDE
- **Local Database**: Only imports from local workspace storage (no remote database support)
- **One-Way Sync**: Changes in the CSV file are not synced back to CodeRabbit
- **No Real-Time Updates**: Manual import required; no automatic synchronization

## FAQ

**Q: Can I import from VS Code instead of Cursor IDE?**
A: No, CodeRabbit's database format is specific to Cursor IDE. VS Code doesn't have the same CodeRabbit integration.

**Q: Will importing overwrite my existing comments?**
A: No, the import process only adds new comments. Duplicates are automatically detected and skipped.

**Q: Can I re-import the same review?**
A: Yes, but duplicate comments will be skipped. Only new comments from that review will be imported.

**Q: What happens to comments I delete from the CSV file?**
A: Deleted comments won't be re-imported unless you delete the entire CSV file and start fresh.

**Q: Can I customize which CodeRabbit comments are imported?**
A: Yes, use the filter options (branch, date range, latest only). Comments marked as resolved in CodeRabbit are automatically excluded.

**Q: How do I know which comments came from CodeRabbit?**
A: Imported comments retain their original CodeRabbit ID. You can also check the comment text format, which includes CodeRabbit's suggestions and analysis sections.

**Q: Can I import from multiple workspaces?**
A: Yes, but each workspace has its own CodeRabbit database. Switch to the desired workspace in Cursor IDE before importing.

## Support

If you encounter issues not covered in this guide:

1. Check the extension's output channel for detailed logs
2. Verify your configuration settings
3. Try with minimal filters first (All branches, no dates)
4. Report issues on the extension's GitHub repository with:
   - Error messages from the output channel
   - Your configuration settings (sanitized)
   - Steps to reproduce the issue
