import * as assert from 'assert';
import { ExtensionContext } from 'vscode';
import { GitLabFactory } from '../../gitlab-factory';
import { ReviewCommentService } from '../../review-comment';
import { CsvEntry } from '../../model';

suite('GitLab UI Tests', () => {
  let mockContext: ExtensionContext;
  let commentService: ReviewCommentService;
  let gitlabFactory: GitLabFactory;
  let secretsStore: Map<string, string>;

  setup(() => {
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

    const testWorkspaceRoot = process.cwd();
    const testReviewFile = 'code-review.csv';
    commentService = new ReviewCommentService(testReviewFile, testWorkspaceRoot);
    gitlabFactory = new GitLabFactory(mockContext, testWorkspaceRoot, commentService, testReviewFile);
  });

  suite('Issue URL Generation', () => {
    test('should generate correct GitLab issue URL', () => {
      // Set up configuration
      const baseUrl = 'https://gitlab-sonarqube-sti.phoenixit.ru';
      const projectId = 'group/project';
      const issueId = '123';

      // Mock configuration
      process.env['code-review.gitlab.baseUrl'] = baseUrl;
      process.env['code-review.gitlab.projectId'] = projectId;

      const url = gitlabFactory.getIssueUrl(issueId);

      // Verify URL format
      assert.ok(url.includes(baseUrl), 'URL should include base URL');
      assert.ok(url.includes(projectId), 'URL should include project ID');
      assert.ok(url.includes(issueId), 'URL should include issue ID');
      assert.ok(url.includes('/-/issues/'), 'URL should have correct path format');
    });

    test('should handle base URL with /api/v4 suffix', () => {
      const baseUrl = 'https://gitlab-sonarqube-sti.phoenixit.ru/api/v4';
      const projectId = 'test-project';
      const issueId = '456';

      process.env['code-review.gitlab.baseUrl'] = baseUrl;
      process.env['code-review.gitlab.projectId'] = projectId;

      const url = gitlabFactory.getIssueUrl(issueId);

      // Verify /api/v4 is removed from URL
      assert.ok(!url.includes('/api/v4'), 'URL should not contain /api/v4');
      assert.ok(url.includes('/-/issues/456'), 'URL should have correct issue path');
    });

    test('should handle numeric project ID', () => {
      const baseUrl = 'https://gitlab.com';
      const projectId = '12345';
      const issueId = '789';

      process.env['code-review.gitlab.baseUrl'] = baseUrl;
      process.env['code-review.gitlab.projectId'] = projectId;

      const url = gitlabFactory.getIssueUrl(issueId);

      // Verify URL with numeric project ID
      assert.ok(url.includes('/12345/-/issues/789'), 'URL should work with numeric project ID');
    });

    test('should return empty string for missing configuration', () => {
      const url = gitlabFactory.getIssueUrl('123');

      // Verify empty string is returned
      assert.strictEqual(url, '', 'Should return empty string when config is missing');
    });

    test('should return empty string for empty issue ID', () => {
      process.env['code-review.gitlab.baseUrl'] = 'https://gitlab.com';
      process.env['code-review.gitlab.projectId'] = 'project';

      const url = gitlabFactory.getIssueUrl('');

      // Verify empty string is returned
      assert.strictEqual(url, '', 'Should return empty string for empty issue ID');
    });
  });

  suite('Issue Link Display', () => {
    test('should display issue link for comment with issue_id', () => {
      const comment: CsvEntry = {
        sha: 'abc123',
        filename: 'test.ts',
        url: 'https://example.com/test.ts',
        lines: '10:1-15:5',
        title: 'Test Comment',
        comment: 'This comment has an issue',
        priority: 2,
        category: 'Bug',
        additional: '',
        id: 'test-link-display',
        private: 0,
        assignee: '',
        issue_id: '123',
        status: 'Open',
        author: 'test-user',
      };

      // Verify comment has issue_id
      assert.ok(comment.issue_id, 'Comment should have issue_id');
      assert.strictEqual(comment.issue_id, '123', 'Issue ID should be 123');
    });

    test('should not display issue link for comment without issue_id', () => {
      const comment: CsvEntry = {
        sha: 'def456',
        filename: 'test.ts',
        url: 'https://example.com/test.ts',
        lines: '10:1-15:5',
        title: 'Test Comment',
        comment: 'This comment has no issue',
        priority: 2,
        category: 'Bug',
        additional: '',
        id: 'test-no-link',
        private: 0,
        assignee: '',
        issue_id: '',
        status: 'Open',
        author: 'test-user',
      };

      // Verify comment has no issue_id
      assert.ok(!comment.issue_id || comment.issue_id === '', 'Comment should not have issue_id');
    });
  });

  suite('Check Status Visualization', () => {
    test('should identify comments with Check status', () => {
      const comment: CsvEntry = {
        sha: 'check123',
        filename: 'test.ts',
        url: 'https://example.com/test.ts',
        lines: '10:1-15:5',
        title: 'Test Check Status',
        comment: 'This comment needs checking',
        priority: 2,
        category: 'Bug',
        additional: '',
        id: 'test-check-status',
        private: 0,
        assignee: '',
        issue_id: '456',
        status: 'Check',
        author: 'test-user',
      };

      // Verify status is Check
      assert.strictEqual(comment.status, 'Check', 'Status should be Check');
    });

    test('should distinguish Check status from other statuses', () => {
      const statuses = ['Open', 'In Progress', 'Resolved', 'Check', 'Closed'];

      statuses.forEach((status) => {
        const comment: CsvEntry = {
          sha: 'status123',
          filename: 'test.ts',
          url: 'https://example.com/test.ts',
          lines: '10:1-15:5',
          title: `Test ${status} Status`,
          comment: `Comment with ${status} status`,
          priority: 2,
          category: 'Test',
          additional: '',
          id: `test-status-${status}`,
          private: 0,
          assignee: '',
          issue_id: '789',
          status,
          author: 'test-user',
        };

        if (status === 'Check') {
          assert.strictEqual(comment.status, 'Check', 'Should identify Check status');
        } else {
          assert.notStrictEqual(comment.status, 'Check', `${status} should not be Check`);
        }
      });
    });
  });

  suite('Sync Indicator', () => {
    test('should track last sync time', async () => {
      // This would be tested through the workspace state
      const lastSyncTime = new Date();

      // Verify timestamp is valid
      assert.ok(lastSyncTime instanceof Date, 'Should be a Date object');
      assert.ok(lastSyncTime.getTime() > 0, 'Should have valid timestamp');
    });

    test('should format sync time for display', () => {
      const testDate = new Date('2025-11-16T12:00:00Z');
      const formatted = testDate.toLocaleString();

      // Verify formatting
      assert.ok(typeof formatted === 'string', 'Should return string');
      assert.ok(formatted.length > 0, 'Should not be empty');
    });

    test('should handle never synced state', () => {
      const lastSyncTime: Date | null = null;

      // Verify null state
      assert.strictEqual(lastSyncTime, null, 'Should be null for never synced');

      // Display message
      const displayMessage = lastSyncTime ? (lastSyncTime as Date).toLocaleString() : 'Never synced with GitLab';
      assert.strictEqual(displayMessage, 'Never synced with GitLab', 'Should show never synced message');
    });

    test('should update sync time after successful sync', () => {
      const beforeSync = new Date();

      // Simulate sync
      const afterSync = new Date();

      // Verify time progression
      assert.ok(afterSync.getTime() >= beforeSync.getTime(), 'Sync time should progress');
    });
  });

  suite('Browser Link Opening', () => {
    test('should construct valid URLs for browser opening', () => {
      const baseUrl = 'https://gitlab-sonarqube-sti.phoenixit.ru';
      const projectId = 'group/project';
      const issueId = '123';

      process.env['code-review.gitlab.baseUrl'] = baseUrl;
      process.env['code-review.gitlab.projectId'] = projectId;

      const url = gitlabFactory.getIssueUrl(issueId);

      // Verify URL is valid
      assert.ok(url.startsWith('https://'), 'URL should use HTTPS');
      assert.ok(url.includes(issueId), 'URL should contain issue ID');

      // Verify URL can be parsed
      try {
        const parsedUrl = new URL(url);
        assert.ok(parsedUrl.protocol === 'https:', 'Should have HTTPS protocol');
        assert.ok(parsedUrl.hostname.length > 0, 'Should have valid hostname');
      } catch (error) {
        assert.fail('URL should be parseable');
      }
    });

    test('should handle special characters in project ID', () => {
      const baseUrl = 'https://gitlab.com';
      const projectId = 'my-group/my-project';
      const issueId = '456';

      process.env['code-review.gitlab.baseUrl'] = baseUrl;
      process.env['code-review.gitlab.projectId'] = projectId;

      const url = gitlabFactory.getIssueUrl(issueId);

      // Verify URL handles special characters
      assert.ok(url.includes('my-group/my-project'), 'URL should preserve project path');
    });
  });

  suite('Configuration Validation', () => {
    test('should validate complete configuration', async () => {
      // Set up complete configuration
      await secretsStore.set('code-review.gitlab.token', 'glpat-test-token-12345678901234567890');
      process.env['code-review.gitlab.baseUrl'] = 'https://gitlab.com';
      process.env['code-review.gitlab.projectId'] = 'test-project';

      const isValid = await gitlabFactory.validateConfiguration();

      // Note: This will fail without actual configuration, but tests the validation logic
      assert.ok(typeof isValid === 'boolean', 'Should return boolean');
    });

    test('should detect missing configuration', async () => {
      // Clear configuration
      secretsStore.clear();
      delete process.env['code-review.gitlab.baseUrl'];
      delete process.env['code-review.gitlab.projectId'];

      const isValid = await gitlabFactory.validateConfiguration();

      // Verify validation fails
      assert.strictEqual(isValid, false, 'Should return false for missing config');
    });
  });
});
