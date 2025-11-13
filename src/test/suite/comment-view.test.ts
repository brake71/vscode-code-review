import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { suite, test } from 'mocha';
import { ExtensionContext } from 'vscode';
import { CommentsProvider } from '../../comment-view';
import { ExportFactory } from '../../export-factory';
import { FileGenerator } from '../../file-generator';

suite('Comment View - Filter Functionality', () => {
  let commentsProvider: CommentsProvider;
  let exportFactory: ExportFactory;
  let mockContext: ExtensionContext;
  let testWorkspaceRoot: string;
  let testCsvPath: string;

  // Setup before tests
  const setupTestEnvironment = () => {
    testWorkspaceRoot = path.join(__dirname, '..', '..', '..', 'test-workspace');
    testCsvPath = path.join(testWorkspaceRoot, '.code-review', 'code-review.csv');

    // Create test workspace directory
    if (!fs.existsSync(testWorkspaceRoot)) {
      fs.mkdirSync(testWorkspaceRoot, { recursive: true });
    }

    const codeReviewDir = path.dirname(testCsvPath);
    if (!fs.existsSync(codeReviewDir)) {
      fs.mkdirSync(codeReviewDir, { recursive: true });
    }

    // Create mock context
    mockContext = {
      asAbsolutePath: (relativePath: string) => path.join(__dirname, '..', '..', '..', relativePath),
    } as ExtensionContext;

    // Create FileGenerator and ExportFactory
    const fileGenerator = new FileGenerator(testWorkspaceRoot);
    exportFactory = new ExportFactory(mockContext, testWorkspaceRoot, fileGenerator);

    // Create CommentsProvider
    commentsProvider = new CommentsProvider(mockContext, exportFactory);
  };

  // Cleanup after tests
  const cleanupTestEnvironment = () => {
    if (fs.existsSync(testCsvPath)) {
      fs.unlinkSync(testCsvPath);
    }
  };

  // Helper to create test CSV file
  const createTestCsvFile = (entries: any[]) => {
    const header =
      'sha,filename,url,lines,title,comment,priority,category,additional,id,private,assignee,issue_id,status,author\n';
    const rows = entries
      .map(
        (e) =>
          `"${e.sha}","${e.filename}","${e.url}","${e.lines}","${e.title}","${e.comment}",${e.priority},"${e.category}","${e.additional}","${e.id}",${e.private},"${e.assignee}","${e.issue_id}","${e.status}","${e.author}"`,
      )
      .join('\n');
    fs.writeFileSync(testCsvPath, header + rows);
  };

  suite('Author Filter', () => {
    test('should set author filter correctly', () => {
      setupTestEnvironment();

      commentsProvider.setAuthorFilter('john.doe');
      const filters = commentsProvider.getActiveFilters();

      assert.strictEqual(filters.author, 'john.doe', 'Author filter should be set to john.doe');

      cleanupTestEnvironment();
    });

    test('should clear author filter when set to null', () => {
      setupTestEnvironment();

      commentsProvider.setAuthorFilter('john.doe');
      commentsProvider.setAuthorFilter(null);
      const filters = commentsProvider.getActiveFilters();

      assert.strictEqual(filters.author, null, 'Author filter should be null');

      cleanupTestEnvironment();
    });

    test('should filter comments by author', async () => {
      setupTestEnvironment();

      const testEntries = [
        {
          sha: 'abc123',
          filename: 'file1.ts',
          url: 'https://example.com',
          lines: '1:0-5:0',
          title: 'Comment 1',
          comment: 'Test comment 1',
          priority: 1,
          category: 'Bug',
          additional: '',
          id: '123e4567-e89b-12d3-a456-426614174001',
          private: 0,
          assignee: 'alice',
          issue_id: 'JIRA-1',
          status: 'Open',
          author: 'john.doe',
        },
        {
          sha: 'def456',
          filename: 'file2.ts',
          url: 'https://example.com',
          lines: '2:0-6:0',
          title: 'Comment 2',
          comment: 'Test comment 2',
          priority: 2,
          category: 'Feature',
          additional: '',
          id: '123e4567-e89b-12d3-a456-426614174002',
          private: 0,
          assignee: 'bob',
          issue_id: 'JIRA-2',
          status: 'In Progress',
          author: 'jane.smith',
        },
      ];

      createTestCsvFile(testEntries);

      commentsProvider.setAuthorFilter('john.doe');
      const files = await commentsProvider.getChildren();

      assert.strictEqual(files.length, 1, 'Should return only one file with comments from john.doe');

      cleanupTestEnvironment();
    });
  });

  suite('Status Filter', () => {
    test('should set status filter correctly', () => {
      setupTestEnvironment();

      commentsProvider.setStatusFilter(['Open', 'In Progress']);
      const filters = commentsProvider.getActiveFilters();

      assert.deepStrictEqual(
        filters.statuses,
        ['Open', 'In Progress'],
        'Status filter should be set to Open and In Progress',
      );

      cleanupTestEnvironment();
    });

    test('should clear status filter when set to empty array', () => {
      setupTestEnvironment();

      commentsProvider.setStatusFilter(['Open']);
      commentsProvider.setStatusFilter([]);
      const filters = commentsProvider.getActiveFilters();

      assert.deepStrictEqual(filters.statuses, [], 'Status filter should be empty array');

      cleanupTestEnvironment();
    });

    test('should filter comments by single status', async () => {
      setupTestEnvironment();

      const testEntries = [
        {
          sha: 'abc123',
          filename: 'file1.ts',
          url: 'https://example.com',
          lines: '1:0-5:0',
          title: 'Comment 1',
          comment: 'Test comment 1',
          priority: 1,
          category: 'Bug',
          additional: '',
          id: '123e4567-e89b-12d3-a456-426614174001',
          private: 0,
          assignee: 'alice',
          issue_id: 'JIRA-1',
          status: 'Open',
          author: 'john.doe',
        },
        {
          sha: 'def456',
          filename: 'file2.ts',
          url: 'https://example.com',
          lines: '2:0-6:0',
          title: 'Comment 2',
          comment: 'Test comment 2',
          priority: 2,
          category: 'Feature',
          additional: '',
          id: '123e4567-e89b-12d3-a456-426614174002',
          private: 0,
          assignee: 'bob',
          issue_id: 'JIRA-2',
          status: 'Resolved',
          author: 'jane.smith',
        },
      ];

      createTestCsvFile(testEntries);

      commentsProvider.setStatusFilter(['Open']);
      const files = await commentsProvider.getChildren();

      assert.strictEqual(files.length, 1, 'Should return only one file with Open status comments');

      cleanupTestEnvironment();
    });

    test('should filter comments by multiple statuses', async () => {
      setupTestEnvironment();

      const testEntries = [
        {
          sha: 'abc123',
          filename: 'file1.ts',
          url: 'https://example.com',
          lines: '1:0-5:0',
          title: 'Comment 1',
          comment: 'Test comment 1',
          priority: 1,
          category: 'Bug',
          additional: '',
          id: '123e4567-e89b-12d3-a456-426614174001',
          private: 0,
          assignee: 'alice',
          issue_id: 'JIRA-1',
          status: 'Open',
          author: 'john.doe',
        },
        {
          sha: 'def456',
          filename: 'file2.ts',
          url: 'https://example.com',
          lines: '2:0-6:0',
          title: 'Comment 2',
          comment: 'Test comment 2',
          priority: 2,
          category: 'Feature',
          additional: '',
          id: '123e4567-e89b-12d3-a456-426614174002',
          private: 0,
          assignee: 'bob',
          issue_id: 'JIRA-2',
          status: 'In Progress',
          author: 'jane.smith',
        },
        {
          sha: 'ghi789',
          filename: 'file3.ts',
          url: 'https://example.com',
          lines: '3:0-7:0',
          title: 'Comment 3',
          comment: 'Test comment 3',
          priority: 3,
          category: 'Bug',
          additional: '',
          id: '123e4567-e89b-12d3-a456-426614174003',
          private: 0,
          assignee: 'charlie',
          issue_id: 'JIRA-3',
          status: 'Resolved',
          author: 'bob.jones',
        },
      ];

      createTestCsvFile(testEntries);

      commentsProvider.setStatusFilter(['Open', 'In Progress']);
      const files = await commentsProvider.getChildren();

      assert.strictEqual(files.length, 2, 'Should return two files with Open or In Progress status');

      cleanupTestEnvironment();
    });
  });

  suite('Combined Filters', () => {
    test('should apply both author and status filters', async () => {
      setupTestEnvironment();

      const testEntries = [
        {
          sha: 'abc123',
          filename: 'file1.ts',
          url: 'https://example.com',
          lines: '1:0-5:0',
          title: 'Comment 1',
          comment: 'Test comment 1',
          priority: 1,
          category: 'Bug',
          additional: '',
          id: '123e4567-e89b-12d3-a456-426614174001',
          private: 0,
          assignee: 'alice',
          issue_id: 'JIRA-1',
          status: 'Open',
          author: 'john.doe',
        },
        {
          sha: 'def456',
          filename: 'file2.ts',
          url: 'https://example.com',
          lines: '2:0-6:0',
          title: 'Comment 2',
          comment: 'Test comment 2',
          priority: 2,
          category: 'Feature',
          additional: '',
          id: '123e4567-e89b-12d3-a456-426614174002',
          private: 0,
          assignee: 'bob',
          issue_id: 'JIRA-2',
          status: 'Resolved',
          author: 'john.doe',
        },
        {
          sha: 'ghi789',
          filename: 'file3.ts',
          url: 'https://example.com',
          lines: '3:0-7:0',
          title: 'Comment 3',
          comment: 'Test comment 3',
          priority: 3,
          category: 'Bug',
          additional: '',
          id: '123e4567-e89b-12d3-a456-426614174003',
          private: 0,
          assignee: 'charlie',
          issue_id: 'JIRA-3',
          status: 'Open',
          author: 'jane.smith',
        },
      ];

      createTestCsvFile(testEntries);

      commentsProvider.setAuthorFilter('john.doe');
      commentsProvider.setStatusFilter(['Open']);
      const files = await commentsProvider.getChildren();

      assert.strictEqual(files.length, 1, 'Should return only one file matching both author=john.doe and status=Open');

      cleanupTestEnvironment();
    });

    test('should return empty when combined filters match nothing', async () => {
      setupTestEnvironment();

      const testEntries = [
        {
          sha: 'abc123',
          filename: 'file1.ts',
          url: 'https://example.com',
          lines: '1:0-5:0',
          title: 'Comment 1',
          comment: 'Test comment 1',
          priority: 1,
          category: 'Bug',
          additional: '',
          id: '123e4567-e89b-12d3-a456-426614174001',
          private: 0,
          assignee: 'alice',
          issue_id: 'JIRA-1',
          status: 'Open',
          author: 'john.doe',
        },
      ];

      createTestCsvFile(testEntries);

      commentsProvider.setAuthorFilter('jane.smith');
      commentsProvider.setStatusFilter(['Resolved']);
      const files = await commentsProvider.getChildren();

      assert.strictEqual(files.length, 0, 'Should return empty array when no comments match both filters');

      cleanupTestEnvironment();
    });
  });

  suite('Filter Clearing', () => {
    test('should clear all filters', () => {
      setupTestEnvironment();

      commentsProvider.setAuthorFilter('john.doe');
      commentsProvider.setStatusFilter(['Open', 'In Progress']);
      commentsProvider.clearAllFilters();

      const filters = commentsProvider.getActiveFilters();

      assert.strictEqual(filters.author, null, 'Author filter should be null after clearing');
      assert.deepStrictEqual(filters.statuses, [], 'Status filter should be empty array after clearing');

      cleanupTestEnvironment();
    });

    test('should show all comments after clearing filters', async () => {
      setupTestEnvironment();

      const testEntries = [
        {
          sha: 'abc123',
          filename: 'file1.ts',
          url: 'https://example.com',
          lines: '1:0-5:0',
          title: 'Comment 1',
          comment: 'Test comment 1',
          priority: 1,
          category: 'Bug',
          additional: '',
          id: '123e4567-e89b-12d3-a456-426614174001',
          private: 0,
          assignee: 'alice',
          issue_id: 'JIRA-1',
          status: 'Open',
          author: 'john.doe',
        },
        {
          sha: 'def456',
          filename: 'file2.ts',
          url: 'https://example.com',
          lines: '2:0-6:0',
          title: 'Comment 2',
          comment: 'Test comment 2',
          priority: 2,
          category: 'Feature',
          additional: '',
          id: '123e4567-e89b-12d3-a456-426614174002',
          private: 0,
          assignee: 'bob',
          issue_id: 'JIRA-2',
          status: 'Resolved',
          author: 'jane.smith',
        },
      ];

      createTestCsvFile(testEntries);

      commentsProvider.setAuthorFilter('john.doe');
      let files = await commentsProvider.getChildren();
      assert.strictEqual(files.length, 1, 'Should return one file with filter applied');

      commentsProvider.clearAllFilters();
      files = await commentsProvider.getChildren();
      assert.strictEqual(files.length, 2, 'Should return all files after clearing filters');

      cleanupTestEnvironment();
    });
  });

  suite('Empty Result Handling', () => {
    test('should return empty array when no comments match author filter', async () => {
      setupTestEnvironment();

      const testEntries = [
        {
          sha: 'abc123',
          filename: 'file1.ts',
          url: 'https://example.com',
          lines: '1:0-5:0',
          title: 'Comment 1',
          comment: 'Test comment 1',
          priority: 1,
          category: 'Bug',
          additional: '',
          id: '123e4567-e89b-12d3-a456-426614174001',
          private: 0,
          assignee: 'alice',
          issue_id: 'JIRA-1',
          status: 'Open',
          author: 'john.doe',
        },
      ];

      createTestCsvFile(testEntries);

      commentsProvider.setAuthorFilter('nonexistent.author');
      const files = await commentsProvider.getChildren();

      assert.strictEqual(files.length, 0, 'Should return empty array when no comments match author filter');

      cleanupTestEnvironment();
    });

    test('should return empty array when no comments match status filter', async () => {
      setupTestEnvironment();

      const testEntries = [
        {
          sha: 'abc123',
          filename: 'file1.ts',
          url: 'https://example.com',
          lines: '1:0-5:0',
          title: 'Comment 1',
          comment: 'Test comment 1',
          priority: 1,
          category: 'Bug',
          additional: '',
          id: '123e4567-e89b-12d3-a456-426614174001',
          private: 0,
          assignee: 'alice',
          issue_id: 'JIRA-1',
          status: 'Open',
          author: 'john.doe',
        },
      ];

      createTestCsvFile(testEntries);

      commentsProvider.setStatusFilter(['Closed']);
      const files = await commentsProvider.getChildren();

      assert.strictEqual(files.length, 0, 'Should return empty array when no comments match status filter');

      cleanupTestEnvironment();
    });

    test('should return empty array when CSV file does not exist', async () => {
      setupTestEnvironment();

      commentsProvider.setAuthorFilter('john.doe');
      const files = await commentsProvider.getChildren();

      assert.strictEqual(files.length, 0, 'Should return empty array when CSV file does not exist');

      cleanupTestEnvironment();
    });
  });
});
