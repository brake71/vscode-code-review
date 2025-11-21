# vscode-code-review
<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
[![All Contributors](https://img.shields.io/badge/all_contributors-9-orange.svg?style=flat-square)](#contributors-)
<!-- ALL-CONTRIBUTORS-BADGE:END -->

<a href="https://www.buymeacoffee.com/dkoppenhagen" target="_blank"><img src="https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png" alt="Buy Me A Coffee" style="height: 41px !important;width: 174px !important;box-shadow: 0px 3px 2px 0px rgba(190, 190, 190, 0.5) !important;-webkit-box-shadow: 0px 3px 2px 0px rgba(190, 190, 190, 0.5) !important;" ></a>

[![VSCode Marketplace](https://img.shields.io/visual-studio-marketplace/v/d-koppenhagen.vscode-code-review?label=Visual%20Studio%20Code%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=d-koppenhagen.vscode-code-review)
[![Open VSX Registry](https://img.shields.io/open-vsx/v/d-koppenhagen/vscode-code-review)](https://open-vsx.org/extension/d-koppenhagen/vscode-code-review)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)
[![Open Source Love](https://badges.frapsoft.com/os/v1/open-source.svg?v=102)](https://github.com/ellerbrock/open-source-badge/)

This extension allows you to create a code review file you can hand over to a customer.

<hr>

- [Features](#features)
  - [create review notes](#create-review-notes)
  - [Code Review Comment Explorer - update, view and delete comments](#code-review-comment-explorer---update-view-and-delete-comments)
    - [Filtering Comments](#filtering-comments)
  - [export created notes as HTML](#export-created-notes-as-html)
    - [Default HTML template](#default-html-template)
    - [Custom HTML handlebars template](#custom-html-handlebars-template)
  - [Export created notes as Markdown](#export-created-notes-as-markdown)
    - [Default Markdown template](#default-markdown-template)
    - [Custom Markdown handlebars template](#custom-markdown-handlebars-template)
  - [Export for Issue Tracking System](#export-for-issue-tracking-system)
    - [export created notes as GitLab importable CSV file](#export-created-notes-as-gitlab-importable-csv-file)
    - [export created notes as GitHub importable CSV file](#export-created-notes-as-github-importable-csv-file)
    - [export created notes as JIRA importable CSV file](#export-created-notes-as-jira-importable-csv-file)
  - [GitLab Integration](#gitlab-integration)
  - [Import from CodeRabbit](#import-from-coderabbit)
- [Extension Settings](#extension-settings)
  - [`code-review.filename`](#code-reviewfilename)
  - [`code-review.baseUrl`](#code-reviewbaseurl)
  - [`code-review.customUrl`](#code-reviewcustomurl)
  - [`code-review.groupBy`](#code-reviewgroupby)
  - [`code-review.categories`](#code-reviewcategories)
  - [`code-review.reportWithCodeSelection`](#code-reviewreportwithcodeselection)
  - [`code-review.reportWithPrivateComments`](#code-reviewreportwithprivatecomments)
  - [`code-review.privateCommentIcon`](#code-reviewprivatecommenticon)
  - [`code-review.defaultTemplatePath`](#code-reviewdefaulttemplatepath)
  - [`code-review.defaultMarkdownTemplatePath`](#code-reviewdefaultmarkdowntemplatepath)
  - [`code-review.priorities`](#code-reviewpriorities)
  - [`code-review.gitDirectory`](#code-reviewgitdirectory)
  - [`code-review.filterCommentsByCommit`](#code-reviewfiltercommentsbycommit)
  - [`code-review.filterCommentsByFilename`](#code-reviewfiltercommentsbyfilename)
  - [`code-review.filterCommentsByPriority`](#code-reviewfiltercommentsbypriority)
  - [`code-review.importBackup`](#code-reviewimportbackup)
  - [`code-review.importConflictMode`](#code-reviewimportconflictmode)
  - [`code-review.importCloneSuffix`](#code-reviewimportclonesuffix)
  - [`code-review.codeSelectionBackgroundColor`](#code-reviewcodeselectionbackgroundcolor)
  - [`code-review.gitlab.baseUrl`](#code-reviewgitlabbaseurl)
  - [`code-review.gitlab.projectId`](#code-reviewgitlabprojectid)
  - [`code-review.gitlab.defaultLabels`](#code-reviewgitlabdefaultlabels)
  - [`code-review.gitlab.issueTemplatePath`](#code-reviewgitlabissuetemplatepath)
- [Themable colors](#themable-colors)
  - [`codereview.priority.green`](#codereviewprioritygreen)
  - [`codereview.priority.yellow`](#codereviewpriorityyellow)
  - [`codereview.priority.red`](#codereviewpriorityred)
  - [`codereview.code.selection.background`](#codereviewcodeselectionbackground)
- [Keybindings](#keybindings)
- [The review approach](#the-review-approach)
- [Contributors ✨](#contributors-)

<hr>

## Features

### create review notes

Simply right click somewhere in the opened file and choose the option "Code Review: Add Note".
You will be prompted for your note you want to add.
A file `code-review.csv` will be created containing your comments and the file and line references.

The result will look like this:

```csv
sha,filename,url,lines,title,comment,priority,additional,status,assignee
"b45d2822d6c87770af520d7e2acc49155f0b4362","/test/a.txt","https://github.com/d-koppenhagen/vscode-code-review/tree/b45d2822d6c87770af520d7e2acc49155f0b4362/test/a.txt","1:2-4:3","foo","this should be refactored","Complexity",1,"see http://foo.bar","open","John Doe"
"b45d2822d6c87770af520d7e2acc49155f0b4362","/test/b.txt","https://github.com/d-koppenhagen/vscode-code-review/tree/b45d2822d6c87770af520d7e2acc49155f0b4362/test/b.txt","1:0-1:4|4:0-4:3","bar","wrong format","Best Practices",1,"","resolved","Jane Smith"
```

The CSV file includes the following columns:
- **sha**: Git commit hash
- **filename**: Relative path to the file
- **url**: Full URL to the file (based on baseUrl/customUrl settings)
- **lines**: Selected ranges or cursor positions (separated by `|`)
- **title**: Comment title/category
- **comment**: The actual comment text
- **priority**: Priority level (1-3)
- **additional**: Additional notes or references
- **status**: Current status of the comment (e.g., open, resolved, in progress)
- **assignee**: Person assigned to address the comment

The line column indicates an array of selected ranges or cursor positions separated by a `|` sign.
E.g. `"1:0-1:4|4:0-4:3"` means that the comment is related to the range marked from line 1 position 0 to line 1 position 4 and line 4 position 0 to line 4 position 3.

Comments in the explorer display the assignee information directly in the description (e.g., `@John Doe`) and in tooltips, making it easy to see who is responsible for addressing each comment.

![Demo](./images/demo.gif)

After adding a review note, your can directly edit and review it from the source by clicking on the annotation above the referenced lines(s).
Parts in the code that are already commented will be decorated by a small underline and by an icon at the end of the referenced code part.
You can also explore and edit/view all comments in the comment explorer (see below).

### Code Review Comment Explorer - update, view and delete comments

Once you created your first code review comment and the plugin can find the associated review file (by default `code-review.csv`), a new button will appear in the sidebar.
Clicking on this button will open the **Code Review Comment Explorer**.
This explorer shows you all made comments to the related code base.
Selecting an entry will open the comment in the webview form, so you can edit and update it.
Performing a right-click on an item, will let you delete a comment.

![Demo: Code Review Comment Explorer](./images/code-review-explorer.gif)

#### Filtering Comments

The Comment Explorer provides powerful filtering capabilities to help you focus on specific comments:

**Available Filters:**

- **Author Filter** - Filter comments by the person who created them
- **Assignee Filter** - Filter comments by the person assigned to address them (including unassigned comments)
- **Status Filter** - Filter comments by their current status (e.g., open, resolved, in progress)
- **Commit Filter** - View only comments from the current commit
- **Filename Filter** - View only comments from the current file
- **Priority Filter** - Hide comments with low priority (green traffic light)

**Using Filters:**

Each filter has a unique icon in the Comment Explorer toolbar. Click on a filter icon to:
- Select from available values (e.g., list of authors, assignees, or statuses)
- Choose "(Clear filter)" to remove that specific filter
- For assignee filter, select "(Unassigned)" to view comments without an assignee

**Visual Indicators:**

- Filter icons change appearance when active, making it easy to see which filters are currently applied
- The status bar shows the count of filtered comments vs. total comments
- Multiple filters can be combined - only comments matching all criteria will be displayed

**Clear All Filters:**

When one or more filters are active, a "Clear All Filters" button appears in the toolbar. Click it to quickly remove all active filters and view all comments.

**State Persistence:**

Your filter settings are automatically saved and restored when you reopen VS Code, so you don't need to reconfigure them each time. Filter states are saved per workspace, allowing different filter configurations for different projects.

**Filter Icons:**

Each filter type has unique icons that change based on their state:

<!--
| Filter Type | Inactive | Active |
|------------|----------|--------|
| Author | ![Author Off](./images/icons/filter-author-off-light.svg) | ![Author On](./images/icons/filter-author-on-light.svg) |
| Assignee | ![Assignee Off](./images/icons/filter-assignee-off-light.svg) | ![Assignee On](./images/icons/filter-assignee-on-light.svg) |
| Status | ![Status Off](./images/icons/filter-status-off-light.svg) | ![Status On](./images/icons/filter-status-on-light.svg) |
| Priority | ![Priority Off](./images/icons/filter-priority-off-light.svg) | ![Priority On](./images/icons/filter-priority-on-light.svg) |
| Filename | ![Filename Off](./images/icons/filter-filename-off-light.svg) | ![Filename On](./images/icons/filter-filename-on-light.svg) |
| Clear All | ![Clear Filters](./images/icons/clear-filters-light.svg) | (Visible only when filters are active) |
-->

### export created notes as HTML

Once you finished your review and added your notes, you can export the results as an HTML report.
Therefore open the [VSCode Command Palette](https://code.visualstudio.com/docs/getstarted/tips-and-tricks#_command-palette) (macOS: ⇧+⌘+P, others: ⇧+Ctrl+P) and search for "Code Review":

![Code Review: Export as HTML](./images/export.png)

#### Default HTML template

When you choose to generate the report using the default template, it will look like this in the end:

![Code Review HTML Export: Default Template](./images/default-template.png)

> You can define a path to a custom template that's used by default when running this command.
> Check out the [Extension Setting 'defaultTemplatePath'](#extension-settings) for further information.

#### Custom HTML handlebars template

You can also choose to export the HTML report by using a custom [Handlebars](https://handlebarsjs.com/) template.
Once you choose this option, you got prompted to choose the template file (file extension must be either `*.hbs`, `*.handlebars`, `*.html` or `*.htm`)

![Code Review HTML Export: Use a custom Handlebars template](./images/template.png)

The used structure to fill the template placeholders is an array of [`ReviewFileExportSection`](https://github.com/d-koppenhagen/vscode-code-review/blob/master/src/interfaces.ts#L31-L44).

Check out the example default template file
[`template.default.hbs`](https://github.com/d-koppenhagen/vscode-code-review/blob/master/src/template.default.hbs), to see how your template should basically look like.

### Export created notes as Markdown

In addition to exporting your notes as HTML, you may also export them as Markdown.
Just like with the HTML export, you may use the default Markdown template provided or choose your own.

#### Default Markdown template

Simply open up the VSCode Command Palette and run the `Export As Markdown With Default Template` command.

> You can define a path to a custom template that's used by default when running this command.
> Check out the [Extension Setting 'defaultMarkdownTemplatePath'](#extension-settings) for further information.
#### Custom Markdown handlebars template

You can also choose to export the Markdown report by using a custom [Handlebars](https://handlebarsjs.com/) template.
Once you choose this option, you got prompted to choose the template file (file extension must be either `*.hbs`, `*.handlebars`, `*.md`, `*.mds` or `*.markdown`)

Check out the example default template file
[`template-markdown.default.hbs`](https://github.com/d-koppenhagen/vscode-code-review/blob/master/src/template-markdown.default.hbs), to see how your template should basically look like.

### Export for Issue Tracking System

#### export created notes as GitLab importable CSV file

Once you finished your code review, you can export the results to a formatted csv file that's [importable into Gitlab issues](https://docs.gitlab.com/ee/user/project/issues/csv_import.html).

![Code Review GitLab importable CSV export](./images/export-gitlab.png)

Once exported, you can import the file in the GitLab project

![GitLab import CSV file](./images/gitlab-import.png)

#### export created notes as GitHub importable CSV file

You can export the code review results to a formatted CSV file that's [importable into GitHub by using `github-csv-tools`](https://github.com/gavinr/github-csv-tools).

![Code Review GitLab importable CSV export](./images/export-github.png)

#### export created notes as JIRA importable CSV file

You can also export the notes as a CSV file to [import them into your JIRA issue tracking system](https://confluence.atlassian.com/adminjiracloud/importing-data-from-csv-776636762.html).

![Code Review JIRA importable CSV export](./images/export-jira.png)

After exporting, you can import the file in your JIRA instance and probably map the props / ignore what you don't need:

![JIRA: import issues from a CSV file](./images/jira-import.png)
![JIRA: map CSV file props](./images/jira-import-map.png)

### GitLab Integration

The extension provides seamless integration with GitLab, allowing you to export code review comments as GitLab issues and synchronize issue statuses back to your review.

**Key Features:**

- 🚀 **Export to GitLab**: Create GitLab issues directly from code review comments
- 🔄 **Status Synchronization**: Automatically sync closed GitLab issues back to your review
- 🔗 **Issue Links**: View and open GitLab issues directly from VS Code
- 📝 **Custom Templates**: Use Handlebars templates to format issue descriptions
- 🏷️ **Default Labels**: Automatically apply labels to created issues
- 🔐 **Secure Token Storage**: Personal Access Tokens stored securely using VS Code Secrets API

**Quick Start:**

1. **Configure GitLab Integration**
   - Open Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
   - Run: **Code Review: Configure GitLab Integration**
   - Enter your GitLab Base URL (e.g., `https://gitlab.com`)
   - Enter your Personal Access Token
   - Enter your Project ID

2. **Export Comments to GitLab**
   - Click the GitLab export button in the Comment Explorer toolbar
   - Or right-click a comment and select "Export to GitLab"
   - Comments are created as GitLab issues with full context

3. **Sync Issue Statuses**
   - Click the sync button in the Comment Explorer toolbar
   - Closed GitLab issues update comment status to "Check"
   - Review and verify fixes before closing comments

**Configuration Settings:**

```json
{
  "code-review.gitlab.baseUrl": "https://gitlab.com",
  "code-review.gitlab.projectId": "123",
  "code-review.gitlab.defaultLabels": ["code-review", "bug"],
  "code-review.gitlab.issueTemplatePath": ".vscode/gitlab-issue-template.hbs"
}
```

**Custom Issue Templates:**

Create a custom Handlebars template to format GitLab issue descriptions:

```handlebars
## 🐛 Code Review Issue

**Priority**: {{priorityName priority}}
**Category**: {{category}}

### 📍 Location
- **File**: [{{filename}}]({{url}})
- **Lines**: {{lines}}

### 💬 Comment
{{comment}}

{{#if code}}
### 📄 Code Snippet
```
{{{codeBlock code}}}
```
{{/if}}
```

**Available Template Variables:**
- `title`, `comment`, `filename`, `lines`, `sha`, `url`
- `priority`, `category`, `additional`, `code`

**Template Helpers:**
- `{{priorityName priority}}` - Converts priority to text (Low, Medium, High, Critical)
- `{{{codeBlock code}}}` - Decodes Base64 code snippet

**Workflow Example:**

1. Complete your code review and add comments
2. Export all comments to GitLab (creates issues)
3. Team works on issues in GitLab
4. Periodically sync to see which issues are closed
5. Review comments marked as "Check" to verify fixes
6. Manually close verified comments

**Documentation:**

- 📖 [Setup Guide](./docs/gitlab-integration-setup.md) - Detailed configuration instructions
- 📘 [Usage Guide](./docs/gitlab-integration-guide.md) - Complete feature documentation
- 🔧 [Troubleshooting](./docs/gitlab-integration-guide.md#troubleshooting) - Common issues and solutions

**Security:**

- Personal Access Tokens are stored securely using VS Code's Secrets API
- Tokens are never saved in workspace settings or version control
- Requires `api` or `write_api` scope for creating and updating issues

### Import from CodeRabbit

If you're using [CodeRabbit](https://coderabbit.ai/) for AI-powered code reviews in Cursor IDE, you can import review comments directly from CodeRabbit's local database into your code review file. This allows you to manage AI-generated findings alongside your manual review comments.

> 📚 **Documentation**: See the [Quick Start Guide](./docs/coderabbit-import-quickstart.md) for a 5-minute setup or the [Complete Guide](./docs/coderabbit-import-guide.md) for detailed information and troubleshooting.

**How it works:**

1. CodeRabbit stores review data in a SQLite database within Cursor IDE's workspace storage
2. The extension automatically locates and reads this database
3. You can filter which reviews to import (by branch, date range, or latest review only)
4. Comments are converted to the extension's CSV format with proper file references and Git SHA information
5. Duplicate comments are automatically detected and skipped

**To import from CodeRabbit:**

1. Open the Command Palette (⇧+⌘+P on macOS, ⇧+Ctrl+P on Windows/Linux)
2. Run the command: **"Code Review: Import from CodeRabbit"**
3. Configure your import filters:
   - **Branch filter**: Select a specific Git branch or choose "All branches"
   - **Start date**: Optionally filter reviews from a specific date (ISO 8601 format: YYYY-MM-DD)
   - **End date**: Optionally filter reviews until a specific date
   - **Latest review only**: Check this to import only the most recent review matching your filters
4. The extension will process the reviews and display import statistics

**What gets imported:**

- Comment text, including suggestions and analysis from CodeRabbit
- File references with line numbers
- Severity levels (mapped to priority: critical→3, major→2, minor/trivial→1)
- Categories from CodeRabbit's indicator types
- Git commit SHA for each file
- URLs to view the code in your repository

**What gets filtered out:**

- Comments that were already imported (duplicates)
- Comments marked as "ignored" in CodeRabbit
- Comments where suggestions were already applied
- Comments that were fixed with AI
- Comments without file references or comment text

**Configuration:**

The import feature uses your existing URL configuration to generate proper links:

- **`code-review.customUrl`** (recommended): Use placeholders for flexible URL generation
  ```json
  {
    "code-review.customUrl": "https://gitlab.com/myorg/myrepo/-/blob/{sha}/{file}#L{start}-{end}"
  }
  ```

- **`code-review.baseUrl`** (fallback): Simple base URL that gets appended with SHA and file path
  ```json
  {
    "code-review.baseUrl": "https://github.com/myorg/myrepo/blob"
  }
  ```

**Troubleshooting:**

- **"CodeRabbit database not found"**: Make sure you're using Cursor IDE and have run at least one CodeRabbit review in your workspace
- **"Invalid URL configuration"**: Configure either `code-review.baseUrl` or `code-review.customUrl` in your settings
- **No comments imported**: Check your filter settings - you might be filtering out all reviews. Try selecting "All branches" and removing date filters
- **Missing file references**: Some CodeRabbit comments might not have file associations and will be skipped automatically
- **Git SHA errors**: If the extension can't determine the commit SHA for a file, it will use the current commit's SHA as a fallback

> 💡 **Tip**: Check the extension's Output Channel ("Code Review") for detailed import logs and diagnostics.

## Extension Settings

The following settings can be adjusted via the configuration file `.vscode/settings.json` or globally when configuring vscode.
The listing below shows the default configuration:

![Visual Studio Code - Code Review Extension Settings](./images/extension-settings.png)

### `code-review.filename`

The filename for the `*.csv` file that stores all comments.
By default, `"code-review"` is used.

```json
{
  "code-review.filename": "my-review-file"
}
```

### `code-review.baseUrl`

The base-URL is used to build a full link to the file.
It will be appended with the git SHA if available followed by the relative path of the file and the selected lines as an anker.
This setting is skipped when the setting `code-review.customUrl` is defined which is more configurable.

```json
{
  "code-review.baseUrl": "https://github.com/foo/bar/blob"
}
```

This setting would lead into something like this: `https://github.com/foo/bar/blob/b0b4...0175/src/file.txt#L12-L19`.

### `code-review.customUrl`

The custom URL is used to build a full link to the file.
The following placeholders are available:

- `{sha}`: insert the SHA ref for the file
- `{file}`: insert the file name/path
- `{start}`: insert the start of the line selection as an anker
- `{end}`: insert the end of the line selection as an anker

```json
{
  "code-review.customUrl": "https://gitlab.com/foo/bar/baz/-/blob/{sha}/src/{file}#L{start}-{end}"
}
```

This setting would lead into something like this: `https://gitlab.com/foo/bar/baz/-/blob/b0b4...0175/src/file.txt#L12-19`

### `code-review.groupBy`

This setting is used when [generating a report](#export-created-notes-as-html) as HTML or Markdown.
The comments will be grouped by either:

- `filename`: default, group by filename
- `priority`: grouping by priorities
- `category`: grouping by the used categories

```json
{
  "code-review.groupBy": "category"
}
```

### `code-review.categories`

Here you can define the categories that will be available for selection when you create comments.

```json
{
  "code-review.categories": [
      "Architecture",
      "Best Practices",
      ...
  ],
}
```

### `code-review.reportWithCodeSelection`

Define whether to include the code selection(s) in generated reports or not.

```json
{
  "code-review.reportWithCodeSelection": true
}
```

> Attention! The code included in the report will be BASE64 encoded in order to prevent breaking report generation by unescaped characters that will be accidentally interpreted.
You can decode this by using the provided Handlebars helper function **`codeBlock`** as shown below:

```hbs
{{#each this as |item|}}
<section>
  {{#each item.lines as |line|}}
  <div>
    <!-- ... -->
    {{#if line.code}}
    <pre><code>{{codeBlock line.code}}</code></pre>
    {{/if}}
    <!-- ... -->
  </div>
  {{/each}}
</section>
{{/each}}
```

### `code-review.reportWithPrivateComments`

Define whether to include private comments in generated reports or not.

```json
{
  "code-review.reportWithPrivateComments": true
}
```

### `code-review.privateCommentIcon`

Identifier of the icon to show next to a private comment.
The available icons are listed in <https://code.visualstudio.com/api/references/icons-in-labels#icon-listing>.
A search engine can be found at <https://microsoft.github.io/vscode-codicons/dist/codicon.html>.

```json
{
  "code-review.privateCommentIcon": "eye-closed"
}
```

### `code-review.defaultTemplatePath`

The path to a default Handlebars template to be used for HTML default export.
The template is used by default when choosing [_'Export as HTML with default template'_](#export-created-notes-as-html) extension command.
If not set, the out-of-the-box template provided by this extension is used.
The configured value must be the full path to the Handlebars template file.

```json
{
  "code-review.defaultTemplatePath": "/Users/my-user/my-code-review-template.hbs"
}
```

### `code-review.defaultMarkdownTemplatePath`

The path to a default Handlebars template to be used for Markdown default export.
The template is used by default when choosing [_'Export as Markdown with default template'_](#export-created-notes-as-markdown) extension command.

If not set, the out-of-the-box template provided by this extension is used.
The configured value must be the full path to the Handlebars template file.

```json
{
  "code-review.defaultMarkdownTemplatePath": "/Users/my-user/my-code-review-template.hbs"
}
```

### `code-review.priorities`

Configure the labels that should be used for the priorities.
The first label is used when no priority is defined. The subsequent labels are given in ascending priority (max. 3 priority levels).
The defaults are listed below:

```json
{
  "code-review.priorities": [
    "none",   // prio not defined
    "low",    // prio value 1 = green traffic light selected
    "medium", // prio value 2 = yellow traffic light selected
    "high"    // prio value 3 = red traffic light selected
  ] // list must contain exact 4 items
}
```

### `code-review.gitDirectory`

Use this setting when the Git repository is located in another directory than the workspace one.
The path can be **relative** (prefixed with `.` or `..`) or **absolute** (prefixed with `/` on Linux/MacOS or `{drive}:\` on Windows).

Examples:

- `./app`: for {workspace}/app (Linux/MacOS)

  ```json
  {
    "code-review.gitDirectory": "./app"
  }
  ```

- `../app`: for a folder at the same level as the workspace (Linux/MacOS)

  ```json
  {
    "code-review.gitDirectory": "../app"
  }
  ```

- `/path/to/my/app`: for an absolute path (Linux/MacOS)

  ```json
  {
    "code-review.gitDirectory": "/path/to/my/app"
  }
  ```

- `C:\Path\To\My\App`: for an absolute path (Windows)

  ```json
  {
    "code-review.gitDirectory": "C:\\Path\\To\\My\\App"
  }
  ```

### `code-review.filterCommentsByCommit`

Define whether to view only the comments from the current commit or not.

```json
{
  "code-review.filterCommentsByCommit": true
}
```

### `code-review.filterCommentsByFilename`

Define whether to view only the comments from the current file or not.

```json
{
  "code-review.filterCommentsByFilename": true
}
```

### `code-review.filterCommentsByPriority`

Define whether to hide the comments that have green priority.

```json
{
  "code-review.filterCommentsByPriority": true
}
```

### `code-review.importBackup`

Define whether to backup, the existing comments before importing new ones or not

```json
{
  "code-review.importBackup": true
}
```

### `code-review.importConflictMode`

Action to automatically take when importing comments already present:

- *empty*: always ask.
- `skip`: keep the existing comment.
- `overwrite`: replace the existing comment with the imported one.
- `clone`: keep both the existing and the imported comments.

```json
{
  "code-review.importConflictMode": "clone"
}
```

### `code-review.importCloneSuffix`

Suffix to append to the title when existing comments are imported in [`clone`](#code-reviewimportconflictmode) mode.

```json
{
  "code-review.importCloneSuffix": "(copy)"
}
```

### `code-review.codeSelectionBackgroundColor`

Background color used to highlight the code associated to a comment.
Must be specified using a hexadecimal representation - with or without the alpha part (`#C8C832` or `#C8C83226`) - or a `rgba()` definition.

```json
{
  "code-review.codeSelectionBackgroundColor": "#C8C83226"
}
```

```json
{
  "code-review.codeSelectionBackgroundColor": "rgba(200, 200, 50, 0.15)"
}
```

### `code-review.gitlab.baseUrl`

The base URL of your GitLab instance. Required for GitLab integration.

```json
{
  "code-review.gitlab.baseUrl": "https://gitlab.com"
}
```

For self-hosted GitLab instances:

```json
{
  "code-review.gitlab.baseUrl": "https://gitlab.example.com"
}
```

### `code-review.gitlab.projectId`

The GitLab project ID where issues will be created. Can be either a numeric ID or a URL-encoded project path.

```json
{
  "code-review.gitlab.projectId": "123"
}
```

Or using project path:

```json
{
  "code-review.gitlab.projectId": "mygroup/myproject"
}
```

### `code-review.gitlab.defaultLabels`

Default labels to automatically apply to all created GitLab issues.

In addition to these default labels, the extension automatically adds:
- **Priority labels**: `minor` (priority 1), `major` (priority 2), `critical` (priority 3)
- **Category labels**: The category value from the comment (e.g., `nitpick`, `potential-issue`, `refactor-suggestion`)

```json
{
  "code-review.gitlab.defaultLabels": ["code-review", "bug", "needs-review"]
}
```

Example: A comment with priority 3 (high) and category "Security" will get labels: `["code-review", "bug", "needs-review", "critical", "security"]`

**Note:** Category labels are normalized to lowercase with spaces replaced by hyphens (e.g., "Potential Issue" → "potential-issue")

### `code-review.gitlab.issueTemplatePath`

Path to a custom Handlebars template for formatting GitLab issue descriptions. If not set, the built-in default template is used.

```json
{
  "code-review.gitlab.issueTemplatePath": ".vscode/gitlab-issue-template.hbs"
}
```

The template can use the following variables:
- `title`, `comment`, `filename`, `lines`, `sha`, `url`
- `priority`, `category`, `additional`, `code`

And helpers:
- `{{priorityName priority}}` - Converts priority number to text
- `{{{codeBlock code}}}` - Decodes Base64 code snippet

See the [GitLab Integration Setup Guide](./docs/gitlab-integration-setup.md) for template examples.

## Themable colors

### `codereview.priority.green`

Color for comments with priority **level 1**.

### `codereview.priority.yellow`

Color for comments with priority **level 2**.

### `codereview.priority.red`

Color for comments with priority **level 3**.

### `codereview.code.selection.background`

Background color for highlighted code.

## Keybindings

To easily add a *new* comment, you can use the keybinding combination `ctrl` + ⇧ + `n`.

## The review approach

If you got a customer request for doing a code review you will ideally receive read access to it's github / gitlab repository or similar.
To create a code review with a report you should install this extension and go on with the following steps:

- Download / clone the customer code and checkout the correct branch
- Open the project in vscode
- [Configure the `baseURL` option](#extension-settings) with the remote URL
  - this will cause that the link in the report is generated with the correct target including SHA, file and line reference
- [Start creating your review notes](#create-review-notes).
- [Export the report](#export-created-notes-as-html).
  - [Probably create an own template first](#custom-handlebars-template)
- Send it to the customer or [import the notes in your issue tracking system](#export-for-issue-tracking-system) and make the customer happy ♥️

**Enjoy!**

## Contributors ✨

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center"><a href="https://github.com/bluenick2k17"><img src="https://avatars1.githubusercontent.com/u/50033488?v=4?s=100" width="100px;" alt="Nick Dunne"/><br /><sub><b>Nick Dunne</b></sub></a><br /><a href="https://github.com/d-koppenhagen/vscode-code-review/commits?author=bluenick2k17" title="Code">💻</a></td>
      <td align="center"><a href="https://github.com/elazarcoh"><img src="https://avatars3.githubusercontent.com/u/28874499?v=4?s=100" width="100px;" alt="elazarcoh"/><br /><sub><b>elazarcoh</b></sub></a><br /><a href="https://github.com/d-koppenhagen/vscode-code-review/commits?author=elazarcoh" title="Code">💻</a> <a href="https://github.com/d-koppenhagen/vscode-code-review/issues?q=author%3Aelazarcoh" title="Bug reports">🐛</a></td>
      <td align="center"><a href="https://fr.linkedin.com/in/michel-caradec-36997650"><img src="https://avatars2.githubusercontent.com/u/12159769?v=4?s=100" width="100px;" alt="Michel Caradec"/><br /><sub><b>Michel Caradec</b></sub></a><br /><a href="https://github.com/d-koppenhagen/vscode-code-review/commits?author=michelcaradec" title="Code">💻</a> <a href="#ideas-michelcaradec" title="Ideas, Planning, & Feedback">🤔</a> <a href="https://github.com/d-koppenhagen/vscode-code-review/issues?q=author%3Amichelcaradec" title="Bug reports">🐛</a> <a href="https://github.com/d-koppenhagen/vscode-code-review/commits?author=michelcaradec" title="Documentation">📖</a> <a href="https://github.com/d-koppenhagen/vscode-code-review/commits?author=michelcaradec" title="Tests">⚠️</a></td>
      <td align="center"><a href="http://k9n.dev"><img src="https://avatars0.githubusercontent.com/u/4279702?v=4?s=100" width="100px;" alt="Danny Koppenhagen"/><br /><sub><b>Danny Koppenhagen</b></sub></a><br /><a href="https://github.com/d-koppenhagen/vscode-code-review/commits?author=d-koppenhagen" title="Code">💻</a> <a href="https://github.com/d-koppenhagen/vscode-code-review/commits?author=d-koppenhagen" title="Tests">⚠️</a> <a href="https://github.com/d-koppenhagen/vscode-code-review/pulls?q=is%3Apr+reviewed-by%3Ad-koppenhagen" title="Reviewed Pull Requests">👀</a> <a href="#maintenance-d-koppenhagen" title="Maintenance">🚧</a> <a href="#ideas-d-koppenhagen" title="Ideas, Planning, & Feedback">🤔</a> <a href="#example-d-koppenhagen" title="Examples">💡</a> <a href="https://github.com/d-koppenhagen/vscode-code-review/commits?author=d-koppenhagen" title="Documentation">📖</a> <a href="https://github.com/d-koppenhagen/vscode-code-review/issues?q=author%3Ad-koppenhagen" title="Bug reports">🐛</a></td>
      <td align="center"><a href="http://www.caero.de"><img src="https://avatars.githubusercontent.com/u/307585?v=4?s=100" width="100px;" alt="Carsten Rösnick-Neugebauer"/><br /><sub><b>Carsten Rösnick-Neugebauer</b></sub></a><br /><a href="https://github.com/d-koppenhagen/vscode-code-review/issues?q=author%3Acroesnick" title="Bug reports">🐛</a></td>
      <td align="center"><a href="https://github.com/brandonchupp"><img src="https://avatars.githubusercontent.com/u/15858979?v=4?s=100" width="100px;" alt="brandonchupp"/><br /><sub><b>brandonchupp</b></sub></a><br /><a href="https://github.com/d-koppenhagen/vscode-code-review/commits?author=brandonchupp" title="Code">💻</a></td>
      <td align="center"><a href="https://github.com/inconspicuous-username"><img src="https://avatars.githubusercontent.com/u/33715078?v=4?s=100" width="100px;" alt="inconspicuous-username"/><br /><sub><b>inconspicuous-username</b></sub></a><br /><a href="#ideas-inconspicuous-username" title="Ideas, Planning, & Feedback">🤔</a></td>
    </tr>
    <tr>
      <td align="center"><a href="https://github.com/avernan"><img src="https://avatars.githubusercontent.com/u/9851882?v=4?s=100" width="100px;" alt="Stefano Guazzotti"/><br /><sub><b>Stefano Guazzotti</b></sub></a><br /><a href="https://github.com/d-koppenhagen/vscode-code-review/commits?author=avernan" title="Code">💻</a></td>
      <td align="center"><a href="https://put.si"><img src="https://avatars.githubusercontent.com/u/5388424?v=4?s=100" width="100px;" alt="Jarmo Puttonen"/><br /><sub><b>Jarmo Puttonen</b></sub></a><br /><a href="https://github.com/d-koppenhagen/vscode-code-review/commits?author=putsi" title="Code">💻</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!
