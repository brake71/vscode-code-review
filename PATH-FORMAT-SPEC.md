# Path Format Specification

## Standard Format

All file paths stored in `code-review.csv` MUST follow this format:

```
/src/utils/helper.ts
/components/Button.tsx
/index.ts
```

### Rules

1. **Always start with `/`** - Leading slash is required
2. **Use forward slashes `/`** - Never use backslashes `\`
3. **Relative to workspace root** - No absolute paths
4. **No trailing slashes** - Paths end with filename

## Examples

### ✅ Correct
```csv
sha,filename,url,lines,...
abc123,/src/utils/helper.ts,https://...,10:0-15:0,...
def456,/components/Button.tsx,https://...,20:0-25:0,...
ghi789,/index.ts,https://...,1:0-5:0,...
```

### ❌ Incorrect
```csv
sha,filename,url,lines,...
abc123,src/utils/helper.ts,https://...,10:0-15:0,...          # Missing leading /
def456,\components\Button.tsx,https://...,20:0-25:0,...      # Using backslashes
ghi789,C:\workspace\index.ts,https://...,1:0-5:0,...         # Absolute path
jkl012,/src/utils/,https://...,1:0-5:0,...                   # Trailing slash
```

## Implementation

### When Creating Paths

Use `standardizeFilename()` which:
1. Removes workspace root
2. Converts `\` to `/`
3. Ensures leading `/`

```typescript
import { standardizeFilename } from './utils/workspace-util';

const absolutePath = 'C:\\workspace\\src\\file.ts';
const workspaceRoot = 'C:\\workspace';
const csvPath = standardizeFilename(workspaceRoot, absolutePath);
// Result: '/src/file.ts'
```

### When Comparing Paths

Normalize both sides:
```typescript
const normalizedPath1 = path1.replace(/\\/g, '/');
const normalizedPath2 = path2.replace(/\\/g, '/');

if (normalizedPath1.endsWith(normalizedPath2)) {
  // Match found
}
```

## Migration from Old Format

Old CSV files may have paths without leading slash or with backslashes:
```csv
src/utils/helper.ts
src\components\Button.tsx
```

These will still work due to normalization during comparison, but new entries will use the standard format.

To migrate existing files:
```typescript
import { migratePathSeparators } from './utils/path-migration';
await migratePathSeparators(reviewFilePath);
```

## Why This Format?

1. **Consistency** - Same format regardless of OS
2. **Clarity** - Leading `/` clearly indicates relative path
3. **Compatibility** - Works with `endsWith()` for matching
4. **Standard** - Follows Unix path conventions
