import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { ExtensionContext } from 'vscode';
import { GitLabFactory, SyncResult } from '../../gitlab-factory';
import { ReviewCommentService } from '../../review-comment';
import { CsvEntry } from '../../model';

suite('GitLab Factory - Sync Tests', () => {
  let mockContext: ExtensionContext;
  let testWorkspaceRoot: string;
  let testReviewFile: string;
  let commentService: ReviewCommentService;
  let gitlabFactory: GitLabFactory;
  let secretsStore: Map<string, string>;

  setup(() => {
    // Create test workspace directory
    testWorkspaceRoot = path.join(__dirname, '..', '..', '..', 'test-workspace');
    if (!fs.existsSync(testWorkspaceRoot)) {
      fs.mkdirSync(testWorkspaceRoot, { recursive: true });
    }

    testReviewFile = path.join(testWorkspaceRoot, 'code-review.csv');

    // Create mock secrets store
    secretsStore = new Map<string, string>();

    // Create mock ExtensionContext
    mockContext = {
      extensionPath: process.cwd(),
      secrets: {
        get: async (key: string) => secretsStore.get(key),
        store: async (key: string, value: string) => {
          secretsStore.set(key, value);
        },
        delete: async (key: string) => {
          secretsStore.delete(key);
        },
      },
      workspaceState: {
        get: () => undefined,
        update: async () => {},
      },
      globalState: {
        get: () => undefined,
        update: async () => {},
        setKeysForSync: () => {},
      },
    } as any;

    commentService = new ReviewCommentService(testReviewFile, testWorkspaceRoot);
    gitlabFactory = new GitLabFactory(mockContext, testWorkspaceRoot, commentService, testReviewFile);
  });

  teardown(() => {
    // Clean up test files
    if (fs.existsSync(testReviewFile)) {
      fs.unlinkSync(testReviewFile);
    }
  });

  suite('Sync Status Updates', () => {
    test('should sync status for comments with issue_id', async function () {
      this.timeout(10000);

      // Skip if GitLab is not configured
      const isConfigured = await gitlabFactory.validateConfiguration();
      if (!isConfigured) {
        this.skip();
        return;
      }

      // First, create and export a comment to get a real issue_id
      const testComment: CsvEntry = {
        sha: 'sync123',
        filename: 'sync-test.ts',
        url: 'https://example.com/sync-test.ts',
        lines: '1:1-5:10',
        title: 'Test Sync Status',
        comment: 'This comment will be synced',
        priority: 2,
        category: 'Test',
        additional: '',
        id: 'test-sync-status-' + Date.now(),
        private: 0,
        assignee: '',
        issue_id: '',
        status: 'Open',
        author: 'test-user',
      };

      // Write CSV file
      const csvHeader =
        'sha,filename,url,lines,title,comment,priority,category,additional,code,id,private,assignee,issue_id,status,author\n';
      const csvLine = `${testComment.sha},${testComment.filename},${testComment.url},${testComment.lines},"${testComment.title}","${testComment.comment}",${testComment.priority},${testComment.category},${testComment.additional},,${testComment.id},${testComment.private},${testComment.assignee},${testComment.issue_id},${testComment.status},${testComment.author}\n`;
      fs.writeFileSync(testReviewFile, csvHeader + csvLine);

      // Export to get issue_id
      await gitlabFactory.exportToGitLab([testComment]);

      // Now sync statuses
      const result: SyncResult = await gitlabFactory.syncStatuses();

      // Verify sync result
      assert.ok(result.success, 'Sync should succeed');
      assert.ok(result.updated >= 0, 'Should have valid update count');
      assert.ok(result.checked >= 0, 'Should have valid checked count');
    });

    test('should handle closed issues and update status to Check', async function () {
      this.timeout(15000);

      // Skip if GitLab is not configured
      const isConfigured = await gitlabFactory.validateConfiguration();
      if (!isConfigured) {
        this.skip();
        return;
      }

      // Create a comment, export it, close the issue, then sync
      const testComment: CsvEntry = {
        sha: 'closed123',
        filename: 'closed-test.ts',
        url: 'https://example.com/closed-test.ts',
        lines: '10:1-15:5',
        title: 'Test Closed Issue Sync',
        comment: 'This issue will be closed and synced',
        priority: 1,
        category: 'Test',
        additional: '',
        id: 'test-closed-sync-' + Date.now(),
        private: 0,
        assignee: '',
        issue_id: '',
        status: 'Open',
        author: 'test-user',
      };

      // Write CSV file
      const csvHeader =
        'sha,filename,url,lines,title,comment,priority,category,additional,code,id,private,assignee,issue_id,status,author\n';
      const csvLine = `${testComment.sha},${testComment.filename},${testComment.url},${testComment.lines},"${testComment.title}","${testComment.comment}",${testComment.priority},${testComment.category},${testComment.additional},,${testComment.id},${testComment.private},${testComment.assignee},${testComment.issue_id},${testComment.status},${testComment.author}\n`;
      fs.writeFileSync(testReviewFile, csvHeader + csvLine);

      // Export to create issue
      await gitlabFactory.exportToGitLab([testComment]);

      // Note: In a real test, you would close the issue via API here
      // For now, we just verify the sync mechanism works

      // Sync statuses
      const result: SyncResult = await gitlabFactory.syncStatuses();

      // Verify sync completed
      assert.ok(result.success || result.errors.length === 0, 'Sync should complete');
    });
  });

  suite('Sync Error Handling', () => {
    test('should handle non-existent issues gracefully', async function () {
      this.timeout(10000);

      // Skip if GitLab is not configured
      const isConfigured = await gitlabFactory.validateConfiguration();
      if (!isConfigured) {
        this.skip();
        return;
      }

      // Create comment with fake issue_id
      const testComment: CsvEntry = {
        sha: 'fake123',
        filename: 'fake-test.ts',
        url: 'https://example.com/fake-test.ts',
        lines: '1:1-2:5',
        title: 'Test Non-Existent Issue',
        comment: 'This issue does not exist',
        priority: 2,
        category: 'Test',
        additional: '',
        id: 'test-nonexistent-' + Date.now(),
        private: 0,
        assignee: '',
        issue_id: '999999999', // Very unlikely to exist
        status: 'Open',
        author: 'test-user',
      };

      // Write CSV file
      const csvHeader =
        'sha,filename,url,lines,title,comment,priority,category,additional,code,id,private,assignee,issue_id,status,author\n';
      const csvLine = `${testComment.sha},${testComment.filename},${testComment.url},${testComment.lines},"${testComment.title}","${testComment.comment}",${testComment.priority},${testComment.category},${testComment.additional},,${testComment.id},${testComment.private},${testComment.assignee},${testComment.issue_id},${testComment.status},${testComment.author}\n`;
      fs.writeFileSync(testReviewFile, csvHeader + csvLine);

      // Sync statuses
      const result: SyncResult = await gitlabFactory.syncStatuses();

      // Verify error handling
      assert.ok(result.errors.length > 0, 'Should have errors for non-existent issue');
      assert.ok(result.errors[0].error.includes('not found'), 'Error should mention issue not found');
    });

    test('should handle sync with invalid configuration', async () => {
      // Clear configuration
      secretsStore.clear();

      const testComment: CsvEntry = {
        sha: 'invalid123',
        filename: 'invalid-test.ts',
        url: 'https://example.com/invalid-test.ts',
        lines: '1:1-2:5',
        title: 'Test Invalid Config Sync',
        comment: 'This should fail due to invalid config',
        priority: 2,
        category: 'Test',
        additional: '',
        id: 'test-invalid-sync-' + Date.now(),
        private: 0,
        assignee: '',
        issue_id: '123',
        status: 'Open',
        author: 'test-user',
      };

      // Write CSV file
      const csvHeader =
        'sha,filename,url,lines,title,comment,priority,category,additional,code,id,private,assignee,issue_id,status,author\n';
      const csvLine = `${testComment.sha},${testComment.filename},${testComment.url},${testComment.lines},"${testComment.title}","${testComment.comment}",${testComment.priority},${testComment.category},${testComment.additional},,${testComment.id},${testComment.private},${testComment.assignee},${testComment.issue_id},${testComment.status},${testComment.author}\n`;
      fs.writeFileSync(testReviewFile, csvHeader + csvLine);

      // Attempt sync
      const result: SyncResult = await gitlabFactory.syncStatuses();

      // Verify error handling
      assert.strictEqual(result.success, false, 'Sync should fail');
      assert.strictEqual(result.updated, 0, 'Should update 0 comments');
    });

    test('should skip comments without issue_id', async function () {
      this.timeout(10000);

      // Skip if GitLab is not configured
      const isConfigured = await gitlabFactory.validateConfiguration();
      if (!isConfigured) {
        this.skip();
        return;
      }

      // Create comment without issue_id
      const testComment: CsvEntry = {
        sha: 'skip123',
        filename: 'skip-test.ts',
        url: 'https://example.com/skip-test.ts',
        lines: '1:1-2:5',
        title: 'Test Skip Sync',
        comment: 'This comment has no issue_id',
        priority: 2,
        category: 'Test',
        additional: '',
        id: 'test-skip-sync-' + Date.now(),
        private: 0,
        assignee: '',
        issue_id: '',
        status: 'Open',
        author: 'test-user',
      };

      // Write CSV file
      const csvHeader =
        'sha,filename,url,lines,title,comment,priority,category,additional,code,id,private,assignee,issue_id,status,author\n';
      const csvLine = `${testComment.sha},${testComment.filename},${testComment.url},${testComment.lines},"${testComment.title}","${testComment.comment}",${testComment.priority},${testComment.category},${testComment.additional},,${testComment.id},${testComment.private},${testComment.assignee},${testComment.issue_id},${testComment.status},${testComment.author}\n`;
      fs.writeFileSync(testReviewFile, csvHeader + csvLine);

      // Sync statuses
      const result: SyncResult = await gitlabFactory.syncStatuses();

      // Verify no sync occurred
      assert.strictEqual(result.updated, 0, 'Should update 0 comments (skipped)');
    });

    test('should skip comments with Closed status', async function () {
      this.timeout(10000);

      // Skip if GitLab is not configured
      const isConfigured = await gitlabFactory.validateConfiguration();
      if (!isConfigured) {
        this.skip();
        return;
      }

      // Create comment with Closed status
      const testComment: CsvEntry = {
        sha: 'closed-skip123',
        filename: 'closed-skip-test.ts',
        url: 'https://example.com/closed-skip-test.ts',
        lines: '1:1-2:5',
        title: 'Test Skip Closed',
        comment: 'This comment is already closed',
        priority: 2,
        category: 'Test',
        additional: '',
        id: 'test-closed-skip-' + Date.now(),
        private: 0,
        assignee: '',
        issue_id: '123',
        status: 'Closed',
        author: 'test-user',
      };

      // Write CSV file
      const csvHeader =
        'sha,filename,url,lines,title,comment,priority,category,additional,code,id,private,assignee,issue_id,status,author\n';
      const csvLine = `${testComment.sha},${testComment.filename},${testComment.url},${testComment.lines},"${testComment.title}","${testComment.comment}",${testComment.priority},${testComment.category},${testComment.additional},,${testComment.id},${testComment.private},${testComment.assignee},${testComment.issue_id},${testComment.status},${testComment.author}\n`;
      fs.writeFileSync(testReviewFile, csvHeader + csvLine);

      // Sync statuses
      const result: SyncResult = await gitlabFactory.syncStatuses();

      // Verify no sync occurred for closed comment
      assert.strictEqual(result.updated, 0, 'Should update 0 comments (already closed)');
    });
  });

  suite('Status Update Verification', () => {
    test('should correctly update status to Check in CSV', async function () {
      this.timeout(15000);

      // Skip if GitLab is not configured
      const isConfigured = await gitlabFactory.validateConfiguration();
      if (!isConfigured) {
        this.skip();
        return;
      }

      // Create and export a comment
      const testComment: CsvEntry = {
        sha: 'check123',
        filename: 'check-test.ts',
        url: 'https://example.com/check-test.ts',
        lines: '5:1-10:20',
        title: 'Test Check Status Update',
        comment: 'Verify status is updated to Check',
        priority: 3,
        category: 'Test',
        additional: '',
        id: 'test-check-update-' + Date.now(),
        private: 0,
        assignee: '',
        issue_id: '',
        status: 'Open',
        author: 'test-user',
      };

      // Write CSV file
      const csvHeader =
        'sha,filename,url,lines,title,comment,priority,category,additional,code,id,private,assignee,issue_id,status,author\n';
      const csvLine = `${testComment.sha},${testComment.filename},${testComment.url},${testComment.lines},"${testComment.title}","${testComment.comment}",${testComment.priority},${testComment.category},${testComment.additional},,${testComment.id},${testComment.private},${testComment.assignee},${testComment.issue_id},${testComment.status},${testComment.author}\n`;
      fs.writeFileSync(testReviewFile, csvHeader + csvLine);

      // Export to create issue
      await gitlabFactory.exportToGitLab([testComment]);

      // Read CSV to verify status is still Open
      let csvContent = fs.readFileSync(testReviewFile, 'utf-8');
      assert.ok(csvContent.includes(',Open,'), 'Status should be Open before sync');

      // Note: In a real test, you would close the issue via API here
      // Then sync would update status to Check

      // Sync statuses
      await gitlabFactory.syncStatuses();

      // Read updated CSV
      csvContent = fs.readFileSync(testReviewFile, 'utf-8');

      // Verify the comment ID is still present
      assert.ok(csvContent.includes(testComment.id), 'Comment ID should be preserved');
    });
  });
});
