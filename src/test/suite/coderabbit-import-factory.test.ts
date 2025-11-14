import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { CodeRabbitImportFactory } from '../../coderabbit-import-factory';
import { CodeRabbitDBConnector, CodeRabbitReview, CodeRabbitComment } from '../../utils/coderabbit-db-connector';
import { FileGenerator } from '../../file-generator';

suite('CodeRabbit Import Factory Test Suite', () => {
  const testWorkspaceRoot = path.join(__dirname, '..', '..', '..', 'test-workspace');
  const testReviewFile = path.join(testWorkspaceRoot, 'code-review.csv');

  suite('CodeRabbitDBConnector', () => {
    test('should compute workspace hash correctly', () => {
      const connector = new CodeRabbitDBConnector(testWorkspaceRoot);
      // Access private method through any cast for testing
      const hash = (connector as any).computeWorkspaceHash(testWorkspaceRoot);
      assert.ok(hash);
      assert.strictEqual(typeof hash, 'string');
      assert.strictEqual(hash.length, 32); // MD5 hash length
    });

    test('should filter reviews by branch', () => {
      const connector = new CodeRabbitDBConnector(testWorkspaceRoot);
      const reviews: CodeRabbitReview[] = [
        {
          id: '1',
          status: 'completed',
          startedAt: '2024-01-01T00:00:00Z',
          endedAt: '2024-01-01T01:00:00Z',
          branch: 'main',
          fileReviewMap: {},
        },
        {
          id: '2',
          status: 'completed',
          startedAt: '2024-01-02T00:00:00Z',
          endedAt: '2024-01-02T01:00:00Z',
          branch: 'feature',
          fileReviewMap: {},
        },
      ];

      const filtered = (connector as any).filterReviews(reviews, { branch: 'main' });
      assert.strictEqual(filtered.length, 1);
      assert.strictEqual(filtered[0].branch, 'main');
    });

    test('should filter reviews by date range', () => {
      const connector = new CodeRabbitDBConnector(testWorkspaceRoot);
      const reviews: CodeRabbitReview[] = [
        {
          id: '1',
          status: 'completed',
          startedAt: '2024-01-01T00:00:00Z',
          endedAt: '2024-01-01T01:00:00Z',
          branch: 'main',
          fileReviewMap: {},
        },
        {
          id: '2',
          status: 'completed',
          startedAt: '2024-02-01T00:00:00Z',
          endedAt: '2024-02-01T01:00:00Z',
          branch: 'main',
          fileReviewMap: {},
        },
      ];

      const filtered = (connector as any).filterReviews(reviews, {
        startDate: '2024-01-15',
        endDate: '2024-02-15',
      });
      assert.strictEqual(filtered.length, 1);
      assert.strictEqual(filtered[0].id, '2');
    });

    test('should filter to latest review only', () => {
      const connector = new CodeRabbitDBConnector(testWorkspaceRoot);
      const reviews: CodeRabbitReview[] = [
        {
          id: '1',
          status: 'completed',
          startedAt: '2024-01-01T00:00:00Z',
          endedAt: '2024-01-01T01:00:00Z',
          branch: 'main',
          fileReviewMap: {},
        },
        {
          id: '2',
          status: 'completed',
          startedAt: '2024-02-01T00:00:00Z',
          endedAt: '2024-02-01T01:00:00Z',
          branch: 'main',
          fileReviewMap: {},
        },
      ];

      const filtered = (connector as any).filterReviews(reviews, { latestOnly: true });
      assert.strictEqual(filtered.length, 1);
      assert.strictEqual(filtered[0].id, '2');
    });

    test('should extract comments from reviews', () => {
      const connector = new CodeRabbitDBConnector(testWorkspaceRoot);
      const reviews: CodeRabbitReview[] = [
        {
          id: '1',
          status: 'completed',
          startedAt: '2024-01-01T00:00:00Z',
          endedAt: '2024-01-01T01:00:00Z',
          branch: 'main',
          fileReviewMap: {
            'src/test.ts': {
              comments: [
                {
                  id: 'comment-1',
                  filename: 'src/test.ts',
                  startLine: 10,
                  endLine: 15,
                  comment: 'Test comment',
                  severity: 'major',
                },
              ],
              status: 1,
            },
          },
        },
      ];

      const comments = connector.extractComments(reviews);
      assert.strictEqual(comments.length, 1);
      assert.strictEqual(comments[0].id, 'comment-1');
      assert.strictEqual(comments[0].filename, 'src/test.ts');
    });

    test('should filter out resolved comments', () => {
      const connector = new CodeRabbitDBConnector(testWorkspaceRoot);
      const reviews: CodeRabbitReview[] = [
        {
          id: '1',
          status: 'completed',
          startedAt: '2024-01-01T00:00:00Z',
          endedAt: '2024-01-01T01:00:00Z',
          branch: 'main',
          fileReviewMap: {
            'src/test.ts': {
              comments: [
                {
                  id: 'comment-1',
                  filename: 'src/test.ts',
                  startLine: 10,
                  endLine: 15,
                  comment: 'Test comment',
                  resolution: 'ignore',
                },
                {
                  id: 'comment-2',
                  filename: 'src/test.ts',
                  startLine: 20,
                  endLine: 25,
                  comment: 'Another comment',
                },
              ],
              status: 1,
            },
          },
        },
      ];

      const comments = connector.extractComments(reviews);
      assert.strictEqual(comments.length, 1);
      assert.strictEqual(comments[0].id, 'comment-2');
    });
  });

  suite('CodeRabbitImportFactory', () => {
    test('should map severity to priority correctly', () => {
      const generator = new FileGenerator(testWorkspaceRoot);
      const factory = new CodeRabbitImportFactory(testWorkspaceRoot, testReviewFile, generator);

      assert.strictEqual((factory as any).mapSeverityToPriority('critical'), 3);
      assert.strictEqual((factory as any).mapSeverityToPriority('major'), 2);
      assert.strictEqual((factory as any).mapSeverityToPriority('minor'), 1);
      assert.strictEqual((factory as any).mapSeverityToPriority('trivial'), 1);
      assert.strictEqual((factory as any).mapSeverityToPriority(undefined), 1);
    });

    test('should extract category from indicator types', () => {
      const generator = new FileGenerator(testWorkspaceRoot);
      const factory = new CodeRabbitImportFactory(testWorkspaceRoot, testReviewFile, generator);

      assert.strictEqual((factory as any).extractCategory(['Security', 'Performance']), 'Security');
      assert.strictEqual((factory as any).extractCategory([]), 'Unknown');
      assert.strictEqual((factory as any).extractCategory(undefined), 'Unknown');
    });

    test('should format comment text with suggestions and analysis', () => {
      const generator = new FileGenerator(testWorkspaceRoot);
      const factory = new CodeRabbitImportFactory(testWorkspaceRoot, testReviewFile, generator);

      const comment: CodeRabbitComment = {
        id: 'test-1',
        filename: 'test.ts',
        startLine: 1,
        endLine: 5,
        comment: 'Main comment',
        suggestions: ['Suggestion 1', 'Suggestion 2'],
        analysis: {
          chain: ['Analysis 1', 'Analysis 2'],
        },
      };

      const formatted = (factory as any).formatCommentText(comment);
      assert.ok(formatted.includes('Main comment'));
      assert.ok(formatted.includes('Предложения:'));
      assert.ok(formatted.includes('Suggestion 1'));
      assert.ok(formatted.includes('Анализ:'));
      assert.ok(formatted.includes('Analysis 1'));
    });

    test('should build URL with customUrl template', () => {
      const generator = new FileGenerator(testWorkspaceRoot);
      const factory = new CodeRabbitImportFactory(testWorkspaceRoot, testReviewFile, generator);

      // Mock configuration
      const mockConfig = {
        get: (key: string) => {
          if (key === 'code-review.customUrl') {
            return 'https://gitlab.com/org/repo/-/blob/{sha}/{file}#L{start}-{end}';
          }
          return '';
        },
      };

      // Replace workspace.getConfiguration temporarily
      const originalGetConfiguration = require('vscode').workspace.getConfiguration;
      require('vscode').workspace.getConfiguration = () => mockConfig;

      const url = (factory as any).buildUrl('abc123', 'src/test.ts', 10, 20);
      assert.strictEqual(url, 'https://gitlab.com/org/repo/-/blob/abc123/src/test.ts#L10-20');

      // Restore original
      require('vscode').workspace.getConfiguration = originalGetConfiguration;
    });

    test('should validate configuration correctly', () => {
      const generator = new FileGenerator(testWorkspaceRoot);
      const factory = new CodeRabbitImportFactory(testWorkspaceRoot, testReviewFile, generator);

      // Mock configuration with no URL
      const mockConfigNoUrl = {
        get: () => '',
      };

      const originalGetConfiguration = require('vscode').workspace.getConfiguration;
      require('vscode').workspace.getConfiguration = () => mockConfigNoUrl;

      assert.throws(() => {
        (factory as any).validateConfiguration();
      }, /Missing URL configuration/);

      // Restore
      require('vscode').workspace.getConfiguration = originalGetConfiguration;
    });
  });
});
