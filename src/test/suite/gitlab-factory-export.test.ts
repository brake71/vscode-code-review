import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { ExtensionContext } from 'vscode';
import { GitLabFactory, ExportResult } from '../../gitlab-factory';
import { ReviewCommentService } from '../../review-comment';
import { CsvEntry } from '../../model';

suite('GitLab Factory - Export Tests', () => {
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

  suite('Export Single Comment', () => {
    test('should export a single comment without issue_id', async function () {
      this.timeout(10000); // Increase timeout for API calls

      // Skip if GitLab is not configured
      const isConfigured = await gitlabFactory.validateConfiguration();
      if (!isConfigured) {
        this.skip();
        return;
      }

      // Create test CSV with a comment without issue_id
      const testComment: CsvEntry = {
        sha: 'abc123',
        filename: 'test.ts',
        url: 'https://example.com/test.ts',
        lines: '10:1-15:5',
        title: 'Test Export Single Comment',
        comment: 'This is a test comment for single export',
        priority: 2,
        category: 'Test',
        additional: '',
        id: 'test-export-single-' + Date.now(),
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

      // Export the comment
      const result: ExportResult = await gitlabFactory.exportToGitLab([testComment]);

      // Verify export result
      assert.strictEqual(result.exported, 1, 'Should export 1 comment');
      assert.strictEqual(result.failed, 0, 'Should have 0 failures');
      assert.strictEqual(result.errors.length, 0, 'Should have no errors');

      // Verify CSV was updated with issue_id
      const csvContent = fs.readFileSync(testReviewFile, 'utf-8');
      const lines = csvContent.split('\n');
      assert.ok(lines[1].includes(','), 'CSV should have issue_id updated');

      // Parse the updated line to check issue_id
      const updatedLine = lines[1];
      const issueIdMatch = updatedLine.match(/,(\d+),/);
      assert.ok(issueIdMatch, 'Should have issue_id in CSV');
      assert.ok(issueIdMatch[1].length > 0, 'Issue ID should not be empty');
    });
  });

  suite('Export Multiple Comments', () => {
    test('should export multiple comments without issue_id', async function () {
      this.timeout(15000); // Increase timeout for multiple API calls

      // Skip if GitLab is not configured
      const isConfigured = await gitlabFactory.validateConfiguration();
      if (!isConfigured) {
        this.skip();
        return;
      }

      // Create test CSV with multiple comments without issue_id
      const testComments: CsvEntry[] = [
        {
          sha: 'abc123',
          filename: 'test1.ts',
          url: 'https://example.com/test1.ts',
          lines: '10:1-15:5',
          title: 'Test Export Multiple Comment 1',
          comment: 'First test comment for bulk export',
          priority: 1,
          category: 'Test',
          additional: '',
          id: 'test-export-bulk-1-' + Date.now(),
          private: 0,
          assignee: '',
          issue_id: '',
          status: 'Open',
          author: 'test-user',
        },
        {
          sha: 'def456',
          filename: 'test2.ts',
          url: 'https://example.com/test2.ts',
          lines: '20:1-25:10',
          title: 'Test Export Multiple Comment 2',
          comment: 'Second test comment for bulk export',
          priority: 2,
          category: 'Test',
          additional: '',
          id: 'test-export-bulk-2-' + Date.now(),
          private: 0,
          assignee: '',
          issue_id: '',
          status: 'Open',
          author: 'test-user',
        },
      ];

      // Write CSV file
      const csvHeader =
        'sha,filename,url,lines,title,comment,priority,category,additional,code,id,private,assignee,issue_id,status,author\n';
      let csvContent = csvHeader;
      testComments.forEach((comment) => {
        csvContent += `${comment.sha},${comment.filename},${comment.url},${comment.lines},"${comment.title}","${comment.comment}",${comment.priority},${comment.category},${comment.additional},,${comment.id},${comment.private},${comment.assignee},${comment.issue_id},${comment.status},${comment.author}\n`;
      });
      fs.writeFileSync(testReviewFile, csvContent);

      // Export all comments
      const result: ExportResult = await gitlabFactory.exportToGitLab();

      // Verify export result
      assert.strictEqual(result.exported, 2, 'Should export 2 comments');
      assert.strictEqual(result.failed, 0, 'Should have 0 failures');
      assert.strictEqual(result.errors.length, 0, 'Should have no errors');
    });
  });

  suite('Export Error Handling', () => {
    test('should handle export with invalid configuration', async () => {
      // Clear configuration
      secretsStore.clear();

      const testComment: CsvEntry = {
        sha: 'abc123',
        filename: 'test.ts',
        url: 'https://example.com/test.ts',
        lines: '10:1-15:5',
        title: 'Test Export Error',
        comment: 'This should fail due to invalid config',
        priority: 2,
        category: 'Test',
        additional: '',
        id: 'test-export-error-' + Date.now(),
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

      // Attempt export
      const result: ExportResult = await gitlabFactory.exportToGitLab([testComment]);

      // Verify error handling
      assert.strictEqual(result.success, false, 'Export should fail');
      assert.strictEqual(result.exported, 0, 'Should export 0 comments');
    });

    test('should skip comments that already have issue_id', async function () {
      this.timeout(10000);

      // Skip if GitLab is not configured
      const isConfigured = await gitlabFactory.validateConfiguration();
      if (!isConfigured) {
        this.skip();
        return;
      }

      // Create test CSV with a comment that already has issue_id
      const testComment: CsvEntry = {
        sha: 'abc123',
        filename: 'test.ts',
        url: 'https://example.com/test.ts',
        lines: '10:1-15:5',
        title: 'Test Skip Export',
        comment: 'This comment already has an issue_id',
        priority: 2,
        category: 'Test',
        additional: '',
        id: 'test-skip-export-' + Date.now(),
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

      // Export (should skip this comment)
      const result: ExportResult = await gitlabFactory.exportToGitLab();

      // Verify no export occurred
      assert.strictEqual(result.exported, 0, 'Should export 0 comments (skipped)');
      assert.strictEqual(result.failed, 0, 'Should have 0 failures');
    });
  });

  suite('CSV Update Verification', () => {
    test('should correctly update issue_id in CSV after export', async function () {
      this.timeout(10000);

      // Skip if GitLab is not configured
      const isConfigured = await gitlabFactory.validateConfiguration();
      if (!isConfigured) {
        this.skip();
        return;
      }

      const testComment: CsvEntry = {
        sha: 'xyz789',
        filename: 'update-test.ts',
        url: 'https://example.com/update-test.ts',
        lines: '5:1-10:20',
        title: 'Test CSV Update',
        comment: 'Verify CSV is updated correctly',
        priority: 3,
        category: 'Test',
        additional: '',
        id: 'test-csv-update-' + Date.now(),
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

      // Read original CSV
      const originalCsv = fs.readFileSync(testReviewFile, 'utf-8');
      assert.ok(originalCsv.includes(',,')); // Empty issue_id field

      // Export the comment
      await gitlabFactory.exportToGitLab([testComment]);

      // Read updated CSV
      const updatedCsv = fs.readFileSync(testReviewFile, 'utf-8');

      // Verify issue_id was added
      assert.notStrictEqual(originalCsv, updatedCsv, 'CSV should be updated');

      // Verify the comment ID is still present
      assert.ok(updatedCsv.includes(testComment.id), 'Comment ID should be preserved');

      // Verify issue_id is no longer empty
      const lines = updatedCsv.split('\n');
      const dataLine = lines[1];
      const fields = dataLine.split(',');
      const issueIdIndex = 13; // issue_id is at index 13
      assert.ok(fields[issueIdIndex] && fields[issueIdIndex].length > 0, 'Issue ID should not be empty');
    });
  });
});
