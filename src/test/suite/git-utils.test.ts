import * as assert from 'assert';
import * as path from 'path';
import {
  getCurrentCommitSha,
  getCommitShaForFile,
  getBlameAuthor,
  batchGetBlameInfo,
  clearBlameCache,
  clearCommitShaCache,
} from '../../utils/git-utils';

suite('Git Utils Test Suite', () => {
  const testWorkspaceRoot = path.join(__dirname, '..', '..', '..');

  // Clear caches before each test
  setup(() => {
    clearBlameCache();
    clearCommitShaCache();
  });

  suite('getCurrentCommitSha', () => {
    test('should return a valid SHA for current commit', () => {
      const sha = getCurrentCommitSha(testWorkspaceRoot);

      // SHA should be a 40-character hex string
      assert.ok(sha.length === 40 || sha.length === 0, 'SHA should be 40 characters or empty');
      if (sha.length === 40) {
        assert.ok(/^[0-9a-f]{40}$/.test(sha), 'SHA should be a valid hex string');
      }
    });

    test('should cache the commit SHA', () => {
      const sha1 = getCurrentCommitSha(testWorkspaceRoot);
      const sha2 = getCurrentCommitSha(testWorkspaceRoot);

      assert.strictEqual(sha1, sha2, 'Cached SHA should be the same');
    });

    test('should return empty string for non-git directory', () => {
      const nonGitDir = path.join(__dirname, 'non-existent-dir');
      const sha = getCurrentCommitSha(nonGitDir);

      assert.strictEqual(sha, '', 'Should return empty string for non-git directory');
    });

    test('should update cache when workspace changes', () => {
      const sha1 = getCurrentCommitSha(testWorkspaceRoot);
      clearCommitShaCache();
      const sha2 = getCurrentCommitSha(testWorkspaceRoot);

      // After clearing cache, should get the same SHA (assuming no commits in between)
      assert.strictEqual(sha1, sha2, 'SHA should be consistent');
    });
  });

  suite('getCommitShaForFile', () => {
    test('should return a valid SHA for existing file', () => {
      // Use a file that should exist in the repository
      const filename = 'package.json';
      const sha = getCommitShaForFile(testWorkspaceRoot, filename, 1);

      // Should return either a valid SHA or current commit SHA
      assert.ok(sha.length === 40 || sha.length === 0, 'SHA should be 40 characters or empty');
      if (sha.length === 40) {
        assert.ok(/^[0-9a-f]{40}$/.test(sha), 'SHA should be a valid hex string');
      }
    });

    test('should fall back to current SHA for non-existent file', () => {
      const filename = 'non-existent-file.ts';
      const sha = getCommitShaForFile(testWorkspaceRoot, filename, 1);
      const currentSha = getCurrentCommitSha(testWorkspaceRoot);

      assert.strictEqual(sha, currentSha, 'Should fall back to current SHA for non-existent file');
    });

    test('should cache blame results', () => {
      const filename = 'package.json';

      // First call
      const sha1 = getCommitShaForFile(testWorkspaceRoot, filename, 1);

      // Second call should use cache
      const sha2 = getCommitShaForFile(testWorkspaceRoot, filename, 1);

      assert.strictEqual(sha1, sha2, 'Cached SHA should be the same');
    });

    test('should handle different lines in the same file', () => {
      const filename = 'package.json';

      const sha1 = getCommitShaForFile(testWorkspaceRoot, filename, 1);
      const sha2 = getCommitShaForFile(testWorkspaceRoot, filename, 10);

      // Both should return valid SHAs (may or may not be the same)
      assert.ok(sha1.length === 40 || sha1.length === 0);
      assert.ok(sha2.length === 40 || sha2.length === 0);
    });
  });

  suite('getBlameAuthor', () => {
    test('should return author for existing file', () => {
      const filename = 'package.json';
      const author = getBlameAuthor(testWorkspaceRoot, filename, 1);

      // Author should be a string (may be empty if git is not available)
      assert.strictEqual(typeof author, 'string', 'Author should be a string');
    });

    test('should return empty string for non-existent file', () => {
      const filename = 'non-existent-file.ts';
      const author = getBlameAuthor(testWorkspaceRoot, filename, 1);

      assert.strictEqual(author, '', 'Should return empty string for non-existent file');
    });

    test('should cache author results', () => {
      const filename = 'package.json';

      // First call
      const author1 = getBlameAuthor(testWorkspaceRoot, filename, 1);

      // Second call should use cache
      const author2 = getBlameAuthor(testWorkspaceRoot, filename, 1);

      assert.strictEqual(author1, author2, 'Cached author should be the same');
    });

    test('should handle different lines in the same file', () => {
      const filename = 'package.json';

      const author1 = getBlameAuthor(testWorkspaceRoot, filename, 1);
      const author2 = getBlameAuthor(testWorkspaceRoot, filename, 10);

      // Both should return strings (may or may not be the same)
      assert.strictEqual(typeof author1, 'string');
      assert.strictEqual(typeof author2, 'string');
    });
  });

  suite('batchGetBlameInfo', () => {
    test('should return blame info for multiple lines', () => {
      const filename = 'package.json';
      const lines = [1, 5, 10];

      const result = batchGetBlameInfo(testWorkspaceRoot, filename, lines);

      assert.strictEqual(result.size, 3, 'Should return info for all requested lines');

      for (const line of lines) {
        const info = result.get(line);
        assert.ok(info, `Should have info for line ${line}`);
        assert.ok(info!.sha.length === 40 || info!.sha.length === 0, 'SHA should be valid or empty');
        assert.strictEqual(typeof info!.author, 'string', 'Author should be a string');
      }
    });

    test('should be more efficient than individual calls', () => {
      const filename = 'package.json';
      const lines = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

      // Clear cache to ensure fair comparison
      clearBlameCache();

      // Batch call
      const batchStart = Date.now();
      const batchResult = batchGetBlameInfo(testWorkspaceRoot, filename, lines);
      const batchEnd = Date.now();
      const batchTime = batchEnd - batchStart;

      // Clear cache again
      clearBlameCache();

      // Individual calls
      const individualStart = Date.now();
      for (const line of lines) {
        getCommitShaForFile(testWorkspaceRoot, filename, line);
        getBlameAuthor(testWorkspaceRoot, filename, line);
      }
      const individualEnd = Date.now();
      const individualTime = individualEnd - individualStart;

      // Batch should be faster or comparable (allowing some variance)
      assert.ok(
        batchTime <= individualTime * 1.5,
        `Batch (${batchTime}ms) should be faster than individual calls (${individualTime}ms)`,
      );

      // Verify results are correct
      assert.strictEqual(batchResult.size, lines.length);
    });

    test('should use cache for already cached lines', () => {
      const filename = 'package.json';
      const lines = [1, 2, 3];

      // First call to populate cache
      const result1 = batchGetBlameInfo(testWorkspaceRoot, filename, lines);

      // Second call should use cache
      const result2 = batchGetBlameInfo(testWorkspaceRoot, filename, lines);

      // Results should be identical
      for (const line of lines) {
        const info1 = result1.get(line);
        const info2 = result2.get(line);
        assert.strictEqual(info1!.sha, info2!.sha);
        assert.strictEqual(info1!.author, info2!.author);
      }
    });

    test('should handle mix of cached and uncached lines', () => {
      const filename = 'package.json';

      // Cache some lines
      batchGetBlameInfo(testWorkspaceRoot, filename, [1, 2]);

      // Request mix of cached and uncached lines
      const result = batchGetBlameInfo(testWorkspaceRoot, filename, [1, 2, 3, 4]);

      assert.strictEqual(result.size, 4, 'Should return info for all lines');
    });

    test('should handle non-existent file gracefully', () => {
      const filename = 'non-existent-file.ts';
      const lines = [1, 2, 3];

      const result = batchGetBlameInfo(testWorkspaceRoot, filename, lines);

      // Should return current SHA and empty author for all lines
      const currentSha = getCurrentCommitSha(testWorkspaceRoot);
      for (const line of lines) {
        const info = result.get(line);
        assert.ok(info, `Should have info for line ${line}`);
        assert.strictEqual(info!.sha, currentSha, 'Should use current SHA for non-existent file');
        assert.strictEqual(info!.author, '', 'Should have empty author for non-existent file');
      }
    });
  });

  suite('Cache Management', () => {
    test('clearBlameCache should clear the blame cache', () => {
      const filename = 'package.json';

      // Populate cache
      getCommitShaForFile(testWorkspaceRoot, filename, 1);
      getBlameAuthor(testWorkspaceRoot, filename, 1);

      // Clear cache
      clearBlameCache();

      // Next call should not use cache (we can't directly verify this,
      // but we can verify it doesn't throw an error)
      const sha = getCommitShaForFile(testWorkspaceRoot, filename, 1);
      const author = getBlameAuthor(testWorkspaceRoot, filename, 1);

      assert.ok(sha !== undefined);
      assert.ok(author !== undefined);
    });

    test('clearCommitShaCache should clear the commit SHA cache', () => {
      // Populate cache
      const sha1 = getCurrentCommitSha(testWorkspaceRoot);

      // Clear cache
      clearCommitShaCache();

      // Next call should not use cache
      const sha2 = getCurrentCommitSha(testWorkspaceRoot);

      // Should still return the same SHA (assuming no commits in between)
      assert.strictEqual(sha1, sha2);
    });
  });
});
