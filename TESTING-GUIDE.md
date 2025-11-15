# Testing Guide for Path Normalization Fix

## What Was Fixed

Fixed path separator inconsistency between CodeRabbit imports (using `/`) and manual additions (using `\` on Windows).

## What Should Work Now

### ✅ Comment Storage
- All new comments stored with forward slashes `/`
- Both CodeRabbit imports and manual additions use same format

### ✅ Comment Display in Editor
- **Underline decorations** - Lines with comments are underlined
- **Comment icons** - Speech bubble icons appear at the end of commented lines
- **CodeLens** - Inline comment previews above code blocks

### ✅ Filtering
- **Filter by filename** - Shows only comments for current file
- **Filter by author** - Shows comments by specific author
- **Filter by status** - Shows comments with specific status
- **Filter by assignee** - Shows comments assigned to specific person

### ✅ Comment Explorer
- Tree view shows all files with comments
- Clicking on file/comment navigates to code

## How to Test

### 1. Test Manual Comment Addition
1. Open any file in your workspace
2. Select some code
3. Add a comment via command palette: `Code Review: Add Note`
4. Check that comment appears in:
   - Comment Explorer (sidebar)
   - CodeLens (above the code)
   - Underline decoration (dashed line under code)
   - Comment icon (speech bubble at line end)

### 2. Test CodeRabbit Import
1. Import comments from CodeRabbit: `Code Review: Import from CodeRabbit`
2. Check that imported comments appear in all the same places as manual comments

### 3. Test Filter by Filename
1. Open a file with comments
2. Enable filter: Click filter icon in Comment Explorer or use command palette
3. Verify only comments for current file are shown
4. Switch to another file
5. Verify comments update to show only current file's comments

### 4. Test Mixed Paths (Backward Compatibility)
1. If you have old CSV with mixed path separators (`\` and `/`)
2. All comments should still display correctly
3. New comments will use normalized format

## Expected CSV Format

### Before (Mixed)
```csv
sha,filename,url,lines,...
abc123,src/utils/helper.ts,https://...,10:0-15:0,...
def456,src\components\Button.tsx,https://...,20:0-25:0,...
```

### After (Normalized)
```csv
sha,filename,url,lines,...
abc123,src/utils/helper.ts,https://...,10:0-15:0,...
def456,src/components/Button.tsx,https://...,20:0-25:0,...
```

## Troubleshooting

### Comments Don't Display
1. Check CSV file format - paths should use `/`
2. Reload VS Code window
3. Check that file path in CSV matches actual file location

### Filter Doesn't Work
1. Disable and re-enable filter
2. Check that `currentFilename` is set correctly (should use `/`)
3. Verify paths in CSV don't have inconsistent leading slashes

### CodeLens Works But Decorations Don't
1. Check `code-review.hiddenInlineStatuses` setting
2. Verify comment status is not in hidden list
3. Check that `matchingFile.data.lines` contains comments

## Debug Tips

Add console.log to check paths:
```typescript
// In workspace.ts highlightCommentsInActiveEditor
console.log('Editor path:', normalizedEditorPath);
console.log('File label:', normalizedFileLabel);
console.log('Matching:', normalizedEditorPath.endsWith(normalizedFileLabel));
```

## Migration

If you have existing CSV with mixed separators, you can:
1. Let it work as-is (backward compatible)
2. Or run migration utility (optional):
```typescript
import { migratePathSeparators } from './utils/path-migration';
await migratePathSeparators(reviewFilePath);
```
