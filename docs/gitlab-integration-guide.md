# GitLab Integration Usage Guide

This guide explains how to use the GitLab integration features in vscode-code-review.

## Prerequisites

Before using GitLab integration, ensure you have:
1. Completed the [GitLab Integration Setup](gitlab-integration-setup.md)
2. Configured your Personal Access Token
3. Set your GitLab Base URL and Project ID

## Features Overview

The GitLab integration provides:
- **Export to GitLab**: Create GitLab issues from code review comments
- **Status Synchronization**: Sync issue statuses back to your comments
- **Issue Links**: View and open GitLab issues directly from VS Code
- **Batch Operations**: Export multiple comments at once

## Exporting Comments to GitLab

### Export All Comments

Export all comments that don't have a GitLab issue yet:

1. Open the **Code Review** sidebar
2. Click the **Export to GitLab** button (GitLab icon) in the toolbar
3. Wait for the export process to complete
4. Review the summary showing:
   - Number of issues created
   - Any errors encountered

**What happens:**
- Only comments without an `issue_id` are exported
- Each comment creates a new GitLab issue
- The issue IID is saved to the comment
- The Comment Explorer refreshes automatically

### Export a Single Comment

Export a specific comment:

1. Open the **Code Review** sidebar
2. Right-click on a comment
3. Select **Export to GitLab**
4. The issue is created and the comment is updated

### Export Result

After export, you'll see a notification with:
```
✅ Successfully exported 5 comments to GitLab
❌ Failed to export 1 comment
```

Click "Show Details" to see error information.

## Viewing GitLab Issues

### In Comment Explorer

Comments with GitLab issues show:
- 🔗 Issue link icon
- Issue IID (e.g., `#123`)

### In Comment Details

When viewing a comment with a GitLab issue:
1. Click on the comment in the explorer
2. The details panel shows:
   - **GitLab Issue**: Clickable link with issue number
   - Click the link to open the issue in your browser

### Opening Issues

Click any GitLab issue link to:
- Open the issue in your default browser
- View the full issue details in GitLab
- Add comments or update the issue

## Synchronizing Issue Statuses

Keep your code review comments in sync with GitLab issue statuses.

### Manual Sync

1. Open the **Code Review** sidebar
2. Click the **Sync with GitLab** button (sync icon) in the toolbar
3. Wait for the sync process to complete
4. Review the summary showing:
   - Number of comments updated
   - Number of comments marked as "Check"

### What Gets Synced

The sync operation:
- Checks all comments with a GitLab issue IID
- Skips comments already marked as "Closed"
- Updates comments when the GitLab issue is closed
- Sets the comment status to "Check" for closed issues

### Status Mapping

| GitLab Issue State | Comment Status |
|-------------------|----------------|
| `opened` | No change |
| `closed` | Changed to "Check" |

### The "Check" Status

When a GitLab issue is closed:
1. The comment status changes to "Check"
2. The comment is highlighted in the explorer
3. You can review the fix and manually close the comment

This workflow ensures you verify that closed issues actually resolve the code review concerns.

### Sync Result

After sync, you'll see a notification:
```
✅ Synced 10 comments with GitLab
📋 3 comments marked as "Check" (issues closed)
```

### Last Sync Indicator

The Comment Explorer shows when the last sync occurred:
```
🔄 Last sync: 11/16/2025, 2:30:45 PM
```

Or if never synced:
```
🔄 Never synced with GitLab
```

## Working with Issue Templates

### Using the Default Template

The extension includes a default template that creates well-formatted issues with:
- Priority and category
- File location and line numbers
- Review comment text
- Code snippets
- Additional information

### Creating a Custom Template

1. Create a `.hbs` file in your workspace:
```bash
mkdir -p .vscode
touch .vscode/gitlab-issue-template.hbs
```

2. Edit the template with your preferred format:
```handlebars
## Review Finding

**Severity**: {{priorityName priority}}
**Type**: {{category}}

### Location
File: `{{filename}}` (lines {{lines}})

### Description
{{comment}}

{{#if code}}
### Code
```
{{{codeBlock code}}}
```
{{/if}}
```

3. Configure VS Code to use your template:
```json
{
  "code-review.gitlab.issueTemplatePath": ".vscode/gitlab-issue-template.hbs"
}
```

### Template Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `title` | Comment title | "Fix null pointer exception" |
| `comment` | Comment text | "This code may throw NPE..." |
| `filename` | File path | "src/utils/helper.ts" |
| `lines` | Line numbers | "45-52" |
| `sha` | Git commit SHA | "abc123..." |
| `url` | File URL | "https://..." |
| `priority` | Priority (0-3) | 2 |
| `category` | Category | "Bug" |
| `additional` | Additional notes | "See issue #123" |
| `code` | Code snippet | (Base64 encoded) |

### Template Helpers

**priorityName**: Convert priority number to text
```handlebars
{{priorityName priority}}
```
Output: `Low`, `Medium`, `High`, or `Critical`

**codeBlock**: Decode Base64 code snippet
```handlebars
{{{codeBlock code}}}
```
Output: Decoded source code

## Managing Default Labels

Configure labels that are automatically added to all created issues:

```json
{
  "code-review.gitlab.defaultLabels": ["code-review", "needs-review", "technical-debt"]
}
```

Labels must exist in your GitLab project, or they will be ignored.

## Workflow Examples

### Scenario 1: Code Review with Issue Tracking

1. **Review Code**: Add comments to code during review
2. **Export Issues**: Export all comments to GitLab
3. **Assign Issues**: In GitLab, assign issues to developers
4. **Track Progress**: Developers work on issues in GitLab
5. **Sync Status**: Periodically sync to see which issues are closed
6. **Verify Fixes**: Review comments marked as "Check"
7. **Close Comments**: Manually close verified comments

### Scenario 2: Single Issue Export

1. **Find Critical Issue**: Identify a critical bug during review
2. **Add Comment**: Create a detailed comment with high priority
3. **Export Immediately**: Right-click → Export to GitLab
4. **Notify Team**: Share the GitLab issue link with the team
5. **Track Resolution**: Monitor the issue in GitLab
6. **Sync and Verify**: Sync when issue is closed, verify the fix

### Scenario 3: Batch Review Process

1. **Complete Review**: Add all review comments (20+ comments)
2. **Categorize**: Set priorities and categories
3. **Bulk Export**: Export all comments at once
4. **GitLab Triage**: Team triages issues in GitLab
5. **Regular Sync**: Sync daily to track progress
6. **Final Review**: Review all "Check" status comments
7. **Close Review**: Mark review as complete

## Filtering and Searching

### Filter by Status

Use the Comment Explorer filters to find:
- Comments with GitLab issues (have `issue_id`)
- Comments marked as "Check" (closed issues)
- Comments without issues (not yet exported)

### Search by Issue ID

In the Comment Explorer search box:
```
#123
```
Finds comments linked to GitLab issue #123

## Error Handling

### Common Errors

**401 Unauthorized**
- **Cause**: Invalid or expired Personal Access Token
- **Solution**: Reconfigure your token using the command palette

**404 Not Found**
- **Cause**: Invalid Project ID or issue doesn't exist
- **Solution**: Verify your Project ID in settings

**422 Unprocessable Entity**
- **Cause**: Invalid issue data (e.g., missing title)
- **Solution**: Check your comment has a title

**429 Too Many Requests**
- **Cause**: Rate limit exceeded
- **Solution**: Wait for the retry period (automatic)

### Retry Logic

The extension automatically retries failed requests:
- Maximum 3 attempts
- Exponential backoff (1s, 2s, 4s)
- Respects GitLab's `Retry-After` header

### Viewing Error Details

Check the Output panel for detailed error logs:
1. View → Output
2. Select "Code Review" from the dropdown
3. Review error messages and stack traces

## Best Practices

### Before Export
- ✅ Review all comments for completeness
- ✅ Set appropriate priorities and categories
- ✅ Add additional context where needed
- ✅ Ensure file paths and line numbers are correct

### During Export
- ✅ Export in batches if you have many comments
- ✅ Monitor the progress notification
- ✅ Check for errors after export completes

### After Export
- ✅ Verify issues were created in GitLab
- ✅ Assign issues to appropriate team members
- ✅ Add labels or milestones in GitLab
- ✅ Link related issues if needed

### Synchronization
- ✅ Sync regularly (daily or weekly)
- ✅ Review "Check" status comments promptly
- ✅ Manually verify fixes before closing comments
- ✅ Keep your code review CSV file in version control

### Template Maintenance
- ✅ Keep templates simple and readable
- ✅ Include all relevant information
- ✅ Test templates with sample data
- ✅ Version control your custom templates

## Keyboard Shortcuts

You can configure custom keyboard shortcuts for GitLab commands:

1. File → Preferences → Keyboard Shortcuts
2. Search for "Code Review"
3. Assign shortcuts to:
   - `codeReview.exportToGitLab`
   - `codeReview.syncWithGitLab`
   - `codeReview.configureGitLab`

Example keybindings.json:
```json
[
  {
    "key": "ctrl+shift+g e",
    "command": "codeReview.exportToGitLab"
  },
  {
    "key": "ctrl+shift+g s",
    "command": "codeReview.syncWithGitLab"
  }
]
```

## Troubleshooting

### Issues Not Appearing in GitLab

1. Check the Output panel for errors
2. Verify your Project ID is correct
3. Ensure your token has `api` or `write_api` scope
4. Check GitLab project permissions

### Sync Not Updating Comments

1. Verify comments have valid issue IIDs
2. Check that issues exist in GitLab
3. Ensure issues are actually closed in GitLab
4. Review the sync summary for errors

### Template Not Working

1. Check template file path in settings
2. Verify template syntax (Handlebars)
3. Test with the default template first
4. Check Output panel for template errors

## Additional Resources

- [GitLab Integration Setup](gitlab-integration-setup.md)
- [GitLab API Documentation](https://docs.gitlab.com/ee/api/)
- [Handlebars Template Guide](https://handlebarsjs.com/guide/)
- [Extension README](../README.md)

## Support

If you encounter issues:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review the Output panel logs
3. Open an issue on GitHub with:
   - Error messages
   - Steps to reproduce
   - VS Code and extension versions
