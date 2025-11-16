import * as assert from 'assert';
import { ExtensionContext } from 'vscode';
import { TemplateEngine } from '../../utils/gitlab-template';
import { GitLabConfigManager } from '../../utils/gitlab-config';
import { CsvEntry } from '../../model';

suite('GitLab Template Engine', () => {
  let mockContext: ExtensionContext;
  let configManager: GitLabConfigManager;
  let templateEngine: TemplateEngine;

  setup(() => {
    // Create a mock ExtensionContext
    mockContext = {
      extensionPath: process.cwd(),
      secrets: {
        get: async () => undefined,
        store: async () => {},
        delete: async () => {},
      },
    } as any;

    configManager = new GitLabConfigManager(mockContext);
    templateEngine = new TemplateEngine(mockContext, configManager);
  });

  suite('Template Rendering', () => {
    test('should render basic comment without optional fields', () => {
      const comment: CsvEntry = {
        sha: 'abc123',
        filename: 'src/test.ts',
        url: 'https://example.com/file',
        lines: '10:1-15:5',
        title: 'Test Issue',
        comment: 'This is a test comment',
        priority: 2,
        category: 'Bug',
        additional: '',
        id: 'test-id-123',
        private: 0,
        assignee: '',
        issue_id: '',
        status: 'Open',
        author: 'test-user',
      };

      const result = templateEngine.renderIssueDescription(comment);

      assert.ok(result.includes('## Приоритет'));
      assert.ok(result.includes('Средний'));
      assert.ok(result.includes('## Категория'));
      assert.ok(result.includes('Bug'));
      assert.ok(result.includes('## Затронутый код'));
      assert.ok(result.includes('src/test.ts'));
      assert.ok(result.includes('10:1-15:5'));
      assert.ok(result.includes('## Комментарий'));
      assert.ok(result.includes('This is a test comment'));
      assert.ok(result.includes('SHA: abc123'));
    });

    test('should render comment with all fields', () => {
      const comment: CsvEntry = {
        sha: 'def456',
        filename: 'src/main.ts',
        url: 'https://example.com/main',
        lines: '20:1-25:10',
        title: 'Complete Issue',
        comment: 'Full comment with details',
        priority: 3,
        category: 'Security',
        additional: 'Additional information here',
        code: 'Y29uc3QgdGVzdCA9ICdoZWxsbyc7', // Base64 encoded: const test = 'hello';
        id: 'test-id-456',
        private: 0,
        assignee: 'john.doe',
        issue_id: '',
        status: 'Open',
        author: 'jane.doe',
      };

      const result = templateEngine.renderIssueDescription(comment);

      assert.ok(result.includes('Высокий'));
      assert.ok(result.includes('Security'));
      assert.ok(result.includes('## Дополнительная информация'));
      assert.ok(result.includes('Additional information here'));
      assert.ok(result.includes('## Исходный код'));
      assert.ok(result.includes("const test = 'hello';"));
    });

    test('should handle missing priority', () => {
      const comment: CsvEntry = {
        sha: '',
        filename: 'test.ts',
        url: '',
        lines: '1:1-1:10',
        title: 'No Priority',
        comment: 'Comment without priority',
        priority: 0,
        category: '',
        additional: '',
        id: 'test-id-789',
        private: 0,
        assignee: '',
        issue_id: '',
        status: 'Open',
        author: '',
      };

      const result = templateEngine.renderIssueDescription(comment);

      assert.ok(result.includes('Не указан'));
    });

    test('should handle missing category', () => {
      const comment: CsvEntry = {
        sha: '',
        filename: 'test.ts',
        url: '',
        lines: '1:1-1:10',
        title: 'No Category',
        comment: 'Comment without category',
        priority: 1,
        category: '',
        additional: '',
        id: 'test-id-101',
        private: 0,
        assignee: '',
        issue_id: '',
        status: 'Open',
        author: '',
      };

      const result = templateEngine.renderIssueDescription(comment);

      assert.ok(result.includes('Не указана'));
    });

    test('should not include optional sections when fields are empty', () => {
      const comment: CsvEntry = {
        sha: '',
        filename: 'test.ts',
        url: '',
        lines: '1:1-1:10',
        title: 'Minimal',
        comment: 'Minimal comment',
        priority: 1,
        category: 'Test',
        additional: '',
        id: 'test-id-202',
        private: 0,
        assignee: '',
        issue_id: '',
        status: 'Open',
        author: '',
      };

      const result = templateEngine.renderIssueDescription(comment);

      assert.ok(!result.includes('## Дополнительная информация'));
      assert.ok(!result.includes('## Исходный код'));
      assert.ok(!result.includes('SHA:'));
    });
  });

  suite('Priority Helper', () => {
    test('should map priority numbers to Russian names', () => {
      const testCases = [
        { priority: 0, expected: 'Не указан' },
        { priority: 1, expected: 'Низкий' },
        { priority: 2, expected: 'Средний' },
        { priority: 3, expected: 'Высокий' },
      ];

      testCases.forEach(({ priority, expected }) => {
        const comment: CsvEntry = {
          sha: '',
          filename: 'test.ts',
          url: '',
          lines: '1:1-1:10',
          title: 'Priority Test',
          comment: 'Testing priority',
          priority,
          category: 'Test',
          additional: '',
          id: `test-id-${priority}`,
          private: 0,
          assignee: '',
          issue_id: '',
          status: 'Open',
          author: '',
        };

        const result = templateEngine.renderIssueDescription(comment);
        assert.ok(result.includes(expected), `Expected "${expected}" for priority ${priority}`);
      });
    });
  });

  suite('Custom Template Support', () => {
    test('should use built-in template when custom template is not configured', () => {
      const comment: CsvEntry = {
        sha: 'abc123',
        filename: 'test.ts',
        url: 'https://example.com/test.ts',
        lines: '10:1-15:5',
        title: 'Built-in Template Test',
        comment: 'Testing built-in template',
        priority: 2,
        category: 'Bug',
        additional: '',
        id: 'test-builtin-template',
        private: 0,
        assignee: '',
        issue_id: '',
        status: 'Open',
        author: 'test-user',
      };

      const result = templateEngine.renderIssueDescription(comment);

      // Verify built-in template structure
      assert.ok(result.includes('## Приоритет'), 'Should have Priority section');
      assert.ok(result.includes('## Категория'), 'Should have Category section');
      assert.ok(result.includes('## Затронутый код'), 'Should have Affected Code section');
      assert.ok(result.includes('## Комментарий'), 'Should have Comment section');
      assert.ok(result.includes('Создано автоматически из code review'), 'Should have footer');
    });

    test('should handle template rendering errors gracefully', () => {
      // Test with malformed data
      const comment: CsvEntry = {
        sha: '',
        filename: '',
        url: '',
        lines: '',
        title: '',
        comment: '',
        priority: 0,
        category: '',
        additional: '',
        id: 'test-error-handling',
        private: 0,
        assignee: '',
        issue_id: '',
        status: 'Open',
        author: '',
      };

      // Should not throw error
      const result = templateEngine.renderIssueDescription(comment);
      assert.ok(typeof result === 'string', 'Should return a string');
      assert.ok(result.length > 0, 'Should return non-empty result');
    });
  });

  suite('Code Block Decoding', () => {
    test('should decode Base64 code snippets correctly', () => {
      const comment: CsvEntry = {
        sha: 'def456',
        filename: 'code-test.ts',
        url: 'https://example.com/code-test.ts',
        lines: '20:1-25:10',
        title: 'Code Block Test',
        comment: 'Testing code block decoding',
        priority: 2,
        category: 'Test',
        additional: '',
        code: 'ZnVuY3Rpb24gdGVzdCgpIHsKICByZXR1cm4gJ2hlbGxvJzsKfQ==', // Base64: function test() {\n  return 'hello';\n}
        id: 'test-code-block',
        private: 0,
        assignee: '',
        issue_id: '',
        status: 'Open',
        author: 'test-user',
      };

      const result = templateEngine.renderIssueDescription(comment);

      assert.ok(result.includes('## Исходный код'), 'Should have Source Code section');
      assert.ok(result.includes('function test()'), 'Should decode Base64 code');
      assert.ok(result.includes("return 'hello'"), 'Should include decoded code content');
    });

    test('should handle empty code field', () => {
      const comment: CsvEntry = {
        sha: 'ghi789',
        filename: 'no-code-test.ts',
        url: 'https://example.com/no-code-test.ts',
        lines: '1:1-5:10',
        title: 'No Code Test',
        comment: 'Testing without code',
        priority: 1,
        category: 'Test',
        additional: '',
        id: 'test-no-code',
        private: 0,
        assignee: '',
        issue_id: '',
        status: 'Open',
        author: 'test-user',
      };

      const result = templateEngine.renderIssueDescription(comment);

      assert.ok(!result.includes('## Исходный код'), 'Should not have Source Code section');
    });

    test('should handle invalid Base64 code gracefully', () => {
      const comment: CsvEntry = {
        sha: 'jkl012',
        filename: 'invalid-code-test.ts',
        url: 'https://example.com/invalid-code-test.ts',
        lines: '1:1-5:10',
        title: 'Invalid Code Test',
        comment: 'Testing with invalid Base64',
        priority: 1,
        category: 'Test',
        additional: '',
        code: 'not-valid-base64!!!',
        id: 'test-invalid-code',
        private: 0,
        assignee: '',
        issue_id: '',
        status: 'Open',
        author: 'test-user',
      };

      // Should not throw error
      const result = templateEngine.renderIssueDescription(comment);
      assert.ok(typeof result === 'string', 'Should return a string');
    });
  });

  suite('Field Rendering', () => {
    test('should render all fields correctly', () => {
      const comment: CsvEntry = {
        sha: 'full123',
        filename: 'src/complete.ts',
        url: 'https://example.com/src/complete.ts',
        lines: '100:1-150:50',
        title: 'Complete Field Test',
        comment: 'Testing all fields rendering',
        priority: 3,
        category: 'Security',
        additional: 'Additional context information',
        code: 'Y29uc3QgdGVzdCA9ICdmdWxsJzs=', // Base64: const test = 'full';
        id: 'test-all-fields',
        private: 0,
        assignee: 'john.doe',
        issue_id: '',
        status: 'Open',
        author: 'jane.doe',
      };

      const result = templateEngine.renderIssueDescription(comment);

      // Verify all sections are present
      assert.ok(result.includes('Высокий'), 'Should show priority');
      assert.ok(result.includes('Security'), 'Should show category');
      assert.ok(result.includes('src/complete.ts'), 'Should show filename');
      assert.ok(result.includes('100:1-150:50'), 'Should show lines');
      assert.ok(result.includes('full123'), 'Should show SHA');
      assert.ok(result.includes('Testing all fields rendering'), 'Should show comment');
      assert.ok(result.includes('Additional context information'), 'Should show additional info');
      assert.ok(result.includes("const test = 'full'"), 'Should show decoded code');
    });

    test('should handle URL links correctly', () => {
      const comment: CsvEntry = {
        sha: 'url123',
        filename: 'src/link-test.ts',
        url: 'https://github.com/user/repo/blob/main/src/link-test.ts',
        lines: '10:1-20:10',
        title: 'URL Link Test',
        comment: 'Testing URL rendering',
        priority: 2,
        category: 'Test',
        additional: '',
        id: 'test-url-link',
        private: 0,
        assignee: '',
        issue_id: '',
        status: 'Open',
        author: 'test-user',
      };

      const result = templateEngine.renderIssueDescription(comment);

      // Verify URL is rendered as Markdown link
      assert.ok(result.includes('[src/link-test.ts]'), 'Should have Markdown link text');
      assert.ok(
        result.includes('(https://github.com/user/repo/blob/main/src/link-test.ts)'),
        'Should have Markdown link URL',
      );
    });

    test('should handle missing URL gracefully', () => {
      const comment: CsvEntry = {
        sha: 'nourl123',
        filename: 'src/no-url-test.ts',
        url: '',
        lines: '5:1-10:10',
        title: 'No URL Test',
        comment: 'Testing without URL',
        priority: 1,
        category: 'Test',
        additional: '',
        id: 'test-no-url',
        private: 0,
        assignee: '',
        issue_id: '',
        status: 'Open',
        author: 'test-user',
      };

      const result = templateEngine.renderIssueDescription(comment);

      // Verify filename is shown without link
      assert.ok(result.includes('src/no-url-test.ts'), 'Should show filename');
      assert.ok(!result.includes('[src/no-url-test.ts]'), 'Should not have Markdown link');
    });
  });
});
