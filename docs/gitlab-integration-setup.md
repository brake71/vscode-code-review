# GitLab Integration Setup Guide

This guide will help you configure the GitLab integration for vscode-code-review extension.

## Prerequisites

- VS Code version 1.59.0 or higher
- Access to a GitLab instance (GitLab.com or self-hosted)
- A GitLab project where you want to create issues

## Step 1: Create a Personal Access Token

To use the GitLab API, you need to create a Personal Access Token with appropriate permissions.

### For GitLab.com or Self-Hosted GitLab:

1. Log in to your GitLab instance
2. Click on your avatar in the top-right corner
3. Select **Settings** (or **Preferences**)
4. In the left sidebar, click **Access Tokens**
5. Fill in the token details:
   - **Token name**: `vscode-code-review` (or any descriptive name)
   - **Expiration date**: Set an appropriate expiration date (optional but recommended)
   - **Select scopes**: Check the following permissions:
     - ✅ `api` - Full API access (required for creating and updating issues)
     - OR ✅ `write_api` - Write access to API (alternative to `api`)
6. Click **Create personal access token**
7. **Important**: Copy the token immediately and store it securely. You won't be able to see it again!

### Token Format

GitLab Personal Access Tokens typically start with `glpat-` followed by alphanumeric characters:
```
glpat-xxxxxxxxxxxxxxxxxxxx
```

## Step 2: Find Your Project ID

You need to identify the GitLab project where issues will be created.

### Method 1: From Project Settings

1. Navigate to your GitLab project
2. Go to **Settings** → **General**
3. Look for **Project ID** at the top of the page
4. Copy the numeric ID (e.g., `123`)

### Method 2: From Project URL

You can also use the URL-encoded project path instead of the numeric ID:
- If your project URL is: `https://gitlab.com/mygroup/myproject`
- Your project path is: `mygroup/myproject`
- URL-encoded: `mygroup%2Fmyproject` (or just use `mygroup/myproject`)

## Step 3: Configure VS Code Extension

### Option 1: Using Command Palette

1. Open VS Code
2. Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)
3. Type and select: **Code Review: Configure GitLab Integration**
4. Follow the prompts to enter:
   - GitLab Base URL
   - Personal Access Token
   - Project ID

### Option 2: Using Settings UI

1. Open VS Code Settings (`Ctrl+,` or `Cmd+,`)
2. Search for "code-review gitlab"
3. Configure the following settings:

#### GitLab Base URL
```
code-review.gitlab.baseUrl
```
**Examples:**
- GitLab.com: `https://gitlab.com`
- Self-hosted: `https://gitlab.example.com`
- Custom instance: `https://gitlab-sonarqube-sti.phoenixit.ru`

#### GitLab Project ID
```
code-review.gitlab.projectId
```
**Examples:**
- Numeric ID: `123`
- Project path: `mygroup/myproject`
- URL-encoded path: `mygroup%2Fmyproject`

#### Personal Access Token

The token is stored securely using VS Code's Secrets API. Use the command palette to set it:
1. Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)
2. Type: **Code Review: Configure GitLab Integration**
3. Enter your Personal Access Token when prompted

### Option 3: Using settings.json

1. Open VS Code Settings (`Ctrl+,` or `Cmd+,`)
2. Click the "Open Settings (JSON)" icon in the top-right
3. Add the following configuration:

```json
{
  "code-review.gitlab.baseUrl": "https://gitlab.com",
  "code-review.gitlab.projectId": "123",
  "code-review.gitlab.defaultLabels": ["code-review", "bug"],
  "code-review.gitlab.issueTemplatePath": ""
}
```

**Note**: The Personal Access Token cannot be set in settings.json for security reasons. Use the command palette method above.

## Step 4: Verify Configuration

Test your GitLab connection:

1. Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
2. Run: **Code Review: Sync with GitLab**
3. If configured correctly, you should see a success message

If you encounter errors:
- **401 Unauthorized**: Check your Personal Access Token
- **404 Not Found**: Verify your Project ID
- **Connection Error**: Check your Base URL

## Advanced Configuration

### Default Labels

You can configure default labels that will be automatically added to all created issues:

```json
{
  "code-review.gitlab.defaultLabels": ["code-review", "bug", "urgent"]
}
```

#### Automatic Label Generation

In addition to the default labels you configure, the extension automatically adds labels based on:

1. **Priority Labels** (based on comment priority):
   - Priority 1 (Low) → `minor`
   - Priority 2 (Medium) → `major`
   - Priority 3 (High) → `critical`
   - Priority 0 (Not set) → no label added

2. **Category Labels** (based on comment category):
   - The category value is normalized: converted to lowercase and spaces replaced with hyphens
   - Examples: `Nitpick` → `nitpick`, `Potential Issue` → `potential-issue`, `Refactor Suggestion` → `refactor-suggestion`

**Example**: A comment with priority 3 and category "security" will get these labels:
```
["code-review", "bug", "urgent", "critical", "security"]
```

This allows you to:
- Filter issues by priority in GitLab
- Group issues by category
- Create automated workflows based on labels

### Custom Issue Template

Create a custom Handlebars template for issue descriptions:

1. Create a `.hbs` file in your workspace (e.g., `.vscode/gitlab-issue-template.hbs`)
2. Configure the template path:

```json
{
  "code-review.gitlab.issueTemplatePath": ".vscode/gitlab-issue-template.hbs"
}
```

#### Template Example

```handlebars
## 🐛 Code Review Issue

**Priority**: {{#if priority}}{{priorityName priority}}{{else}}Not specified{{/if}}
**Category**: {{#if category}}{{category}}{{else}}Not specified{{/if}}

### 📍 Location
- **File**: {{#if url}}[{{filename}}]({{url}}){{else}}{{filename}}{{/if}}
- **Lines**: {{lines}}
{{#if sha}}- **Commit**: {{sha}}{{/if}}

### 💬 Review Comment
{{comment}}

{{#if additional}}
### 📝 Additional Information
{{additional}}
{{/if}}

{{#if code}}
### 📄 Code Snippet
```
{{{codeBlock code}}}
```
{{/if}}

---
*Created by vscode-code-review extension*
```

#### Available Template Variables

- `title` - Comment title
- `comment` - Comment text
- `filename` - File path
- `lines` - Line numbers
- `sha` - Git commit SHA
- `url` - File URL (if available)
- `priority` - Priority level (0-3)
- `category` - Comment category
- `additional` - Additional notes
- `code` - Code snippet (Base64 encoded)

#### Available Handlebars Helpers

- `{{priorityName priority}}` - Converts priority number to text (Low, Medium, High, Critical)
- `{{{codeBlock code}}}` - Decodes Base64 code snippet

## Troubleshooting

### Token Permissions

If you get permission errors, ensure your token has the correct scopes:
- ✅ `api` or `write_api` - Required for creating issues
- ✅ `read_api` - Required for reading issue status

### Rate Limiting

GitLab API has rate limits (typically 600 requests per minute). If you hit the limit:
- The extension will automatically retry with exponential backoff
- Wait for the retry period (shown in error message)
- Consider reducing the frequency of sync operations

### Self-Signed Certificates

If using a self-hosted GitLab with self-signed certificates, you may need to configure Node.js to accept them:

```json
{
  "code-review.gitlab.rejectUnauthorized": false
}
```

**Warning**: Only use this for trusted internal GitLab instances.

## Security Best Practices

1. **Token Storage**: Tokens are stored securely using VS Code's Secrets API
2. **Token Expiration**: Set expiration dates on your tokens
3. **Minimal Permissions**: Only grant necessary API scopes
4. **Token Rotation**: Regularly rotate your tokens
5. **Workspace Sharing**: Tokens are user-specific and not shared in workspace settings

## Next Steps

Once configured, you can:
- Export comments to GitLab issues
- Sync issue statuses back to your code review
- View GitLab issue links in the Comment Explorer

See the [GitLab Integration Guide](gitlab-integration-guide.md) for usage instructions.
