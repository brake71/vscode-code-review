# Path Normalization Example

## Before the Fix

### CodeRabbit Import
```csv
sha,filename,url,lines,...
abc123,src/utils/helper.ts,https://...,10:0-15:0,...
```

### Manual Addition (Windows)
```csv
sha,filename,url,lines,...
def456,src\components\Button.tsx,https://...,20:0-25:0,...
```

### Problem
When filtering by filename in the editor:
- Current file: `C:\workspace\src\utils\helper.ts`
- Standardized: `\src\utils\helper.ts`
- CSV entry: `src/utils/helper.ts`
- **Comparison fails**: `\src\utils\helper.ts` !== `src/utils/helper.ts`

## After the Fix

### CodeRabbit Import
```csv
sha,filename,url,lines,...
abc123,src/utils/helper.ts,https://...,10:0-15:0,...
```

### Manual Addition (Windows)
```csv
sha,filename,url,lines,...
def456,src/components/Button.tsx,https://...,20:0-25:0,...
```
Note: Backslashes are automatically converted to forward slashes

### Solution
When filtering by filename in the editor:
- Current file: `C:\workspace\src\utils\helper.ts`
- Standardized: `/src/utils/helper.ts` (normalized)
- CSV entry: `src/utils/helper.ts`
- Comparison: Both normalized to forward slashes
- **Comparison succeeds**: `/src/utils/helper.ts` matches `src/utils/helper.ts`

## Code Example

```typescript
// Before
export const standardizeFilename = (workspaceRoot: string, filename: string): string => {
  return filename.replace(workspaceRoot, '');
};
// Result on Windows: "\src\utils\helper.ts"

// After
export const standardizeFilename = (workspaceRoot: string, filename: string): string => {
  const relativePath = filename.replace(workspaceRoot, '');
  return normalizePathSeparators(relativePath);
};
// Result on Windows: "/src/utils/helper.ts"

export const normalizePathSeparators = (filePath: string): string => {
  return filePath.replace(/\\/g, '/');
};
```

## Benefits

1. **Consistent Storage**: All paths stored with forward slashes
2. **Reliable Matching**: Path comparisons work regardless of source
3. **Cross-platform**: Works on Windows, macOS, and Linux
4. **Backward Compatible**: Existing CSV files continue to work
