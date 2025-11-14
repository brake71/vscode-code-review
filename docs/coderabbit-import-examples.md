# CodeRabbit Import - Examples

This document provides practical examples of using the CodeRabbit import feature.

## Example 1: First-Time Import (All Reviews)

**Scenario**: You want to import all historical CodeRabbit reviews from your project.

**Steps**:
1. Open Command Palette → `Code Review: Import from CodeRabbit`
2. Configure filters:
   - Branch: `All branches`
   - Start Date: (leave empty)
   - End Date: (leave empty)
   - Latest Review Only: ☐ Unchecked

**Expected Result**:
```
✓ Processed 5 reviews
✓ Imported 23 comments
⊘ Skipped 3 comments (2 duplicates, 1 resolved)
```

## Example 2: Import Latest Review Only

**Scenario**: You just completed a CodeRabbit review and want to import only the newest findings.

**Steps**:
1. Open Command Palette → `Code Review: Import from CodeRabbit`
2. Configure filters:
   - Branch: `main` (or your current branch)
   - Start Date: (leave empty)
   - End Date: (leave empty)
   - Latest Review Only: ☑ Checked

**Expected Result**:
```
✓ Processed 1 review
✓ Imported 7 comments
⊘ Skipped 0 comments
```

## Example 3: Import from Specific Branch

**Scenario**: You're working on a feature branch and only want reviews from that branch.

**Steps**:
1. Open Command Palette → `Code Review: Import from CodeRabbit`
2. Configure filters:
   - Branch: `feature/user-authentication`
   - Start Date: (leave empty)
   - End Date: (leave empty)
   - Latest Review Only: ☐ Unchecked

**Expected Result**:
```
✓ Processed 2 reviews
✓ Imported 12 comments
⊘ Skipped 1 comment (1 duplicate)
```

## Example 4: Import Reviews from Date Range

**Scenario**: You want to import reviews from the last sprint (2 weeks).

**Steps**:
1. Open Command Palette → `Code Review: Import from CodeRabbit`
2. Configure filters:
   - Branch: `All branches`
   - Start Date: `2024-11-01`
   - End Date: `2024-11-14`
   - Latest Review Only: ☐ Unchecked

**Expected Result**:
```
✓ Processed 3 reviews
✓ Imported 18 comments
⊘ Skipped 5 comments (3 duplicates, 2 resolved)
```

## Example 5: Configuration for Different Git Hosts

### GitLab Self-Hosted

```json
{
  "code-review.customUrl": "https://gitlab.company.com/team/project/-/blob/{sha}/{file}#L{start}-{end}"
}
```

**Generated URL**:
```
https://gitlab.company.com/team/project/-/blob/a1b2c3d4/src/auth.ts#L45-52
```

### GitHub Enterprise

```json
{
  "code-review.customUrl": "https://github.company.com/org/repo/blob/{sha}/{file}#L{start}-L{end}"
}
```

**Generated URL**:
```
https://github.company.com/org/repo/blob/a1b2c3d4/src/auth.ts#L45-L52
```

### Bitbucket

```json
{
  "code-review.customUrl": "https://bitbucket.org/workspace/repo/src/{sha}/{file}#lines-{start}:{end}"
}
```

**Generated URL**:
```
https://bitbucket.org/workspace/repo/src/a1b2c3d4/src/auth.ts#lines-45:52
```

## Example 6: Imported Comment Structure

**Original CodeRabbit Comment**:
```
Severity: major
Category: Security
Comment: This function is vulnerable to SQL injection attacks.
Suggestion: Use parameterized queries instead of string concatenation.
Analysis: The user input is directly concatenated into the SQL query without sanitization.
```

**Imported CSV Entry**:
```csv
"a1b2c3d4","src/database.ts","https://gitlab.com/org/repo/-/blob/a1b2c3d4/src/database.ts#L23-28","23:0-28:0","This function is vulnerable to SQL injection attacks.","This function is vulnerable to SQL injection attacks.

Suggestions:
	Use parameterized queries instead of string concatenation.

Analysis:
The user input is directly concatenated into the SQL query without sanitization.",2,"Security","","open","john.doe","",""
```

**In Comment Explorer**:
- Title: "This function is vulnerable to SQL injection attacks."
- Priority: 2 (Yellow/Medium)
- Category: Security
- File: src/database.ts
- Lines: 23-28
- Assignee: @john.doe (from git blame)

## Example 7: Handling Skipped Comments

**Import Statistics**:
```
✓ Processed 4 reviews
✓ Imported 15 comments
⊘ Skipped 8 comments:
  - 3 duplicates (already imported)
  - 2 resolved (marked as "ignore" in CodeRabbit)
  - 2 no file (general comments without file reference)
  - 1 no message (empty comment text)
```

**What This Means**:
- **Duplicates**: These comments were imported in a previous run
- **Resolved**: User marked these as ignored or fixed in CodeRabbit
- **No file**: CodeRabbit comments without specific file associations
- **No message**: Comments with empty text (data quality issue)

## Example 8: Incremental Import Workflow

**Day 1 - Initial Import**:
```
Command: Import from CodeRabbit
Filters: All branches, no dates, not latest only
Result: ✓ Imported 50 comments from 10 reviews
```

**Day 2 - After New Review**:
```
Command: Import from CodeRabbit
Filters: Current branch, latest only
Result: ✓ Imported 5 new comments, ⊘ Skipped 50 duplicates
```

**Day 3 - After Another Review**:
```
Command: Import from CodeRabbit
Filters: Current branch, latest only
Result: ✓ Imported 3 new comments, ⊘ Skipped 55 duplicates
```

This workflow ensures you only import new findings without re-importing existing comments.
