import * as assert from 'assert';
import { suite, test } from 'mocha';
import { CommentLensProvider } from '../../comment-lens-provider';
import { ExportFactory } from '../../export-factory';
import { CsvEntry } from '../../model';

suite('CommentLensProvider - Status Filtering', () => {
  let commentLensProvider: CommentLensProvider;
  let exportFactory: ExportFactory;

  setup(() => {
    exportFactory = {} as ExportFactory;
    commentLensProvider = new CommentLensProvider(exportFactory);
  });

  suite('shouldDisplayInline', () => {
    test('should return false for comment with status "Closed"', () => {
      const comment: CsvEntry = {
        sha: 'abc123',
        filename: 'test.ts',
        url: 'https://example.com',
        lines: '1:0-5:0',
        title: 'Test Comment',
        comment: 'This is a test',
        priority: 1,
        category: 'Bug',
        additional: '',
        id: '123e4567-e89b-12d3-a456-426614174000',
        private: 0,
        assignee: '',
        issue_id: '',
        status: 'Closed',
        author: '',
      };

      const result = (commentLensProvider as any).shouldDisplayInline(comment);
      assert.strictEqual(result, false, 'Comment with status "Closed" should not be displayed inline');
    });

    test('should return true for comment with status "Open"', () => {
      const comment: CsvEntry = {
        sha: 'abc123',
        filename: 'test.ts',
        url: 'https://example.com',
        lines: '1:0-5:0',
        title: 'Test Comment',
        comment: 'This is a test',
        priority: 1,
        category: 'Bug',
        additional: '',
        id: '123e4567-e89b-12d3-a456-426614174000',
        private: 0,
        assignee: '',
        issue_id: '',
        status: 'Open',
        author: '',
      };

      const result = (commentLensProvider as any).shouldDisplayInline(comment);
      assert.strictEqual(result, true, 'Comment with status "Open" should be displayed inline');
    });

    test('should return true for comment with undefined status', () => {
      const comment: CsvEntry = {
        sha: 'abc123',
        filename: 'test.ts',
        url: 'https://example.com',
        lines: '1:0-5:0',
        title: 'Test Comment',
        comment: 'This is a test',
        priority: 1,
        category: 'Bug',
        additional: '',
        id: '123e4567-e89b-12d3-a456-426614174000',
        private: 0,
        assignee: '',
        issue_id: '',
        status: undefined as any,
        author: '',
      };

      const result = (commentLensProvider as any).shouldDisplayInline(comment);
      assert.strictEqual(result, true, 'Comment with undefined status should be displayed inline');
    });

    test('should return true for comment with empty string status', () => {
      const comment: CsvEntry = {
        sha: 'abc123',
        filename: 'test.ts',
        url: 'https://example.com',
        lines: '1:0-5:0',
        title: 'Test Comment',
        comment: 'This is a test',
        priority: 1,
        category: 'Bug',
        additional: '',
        id: '123e4567-e89b-12d3-a456-426614174000',
        private: 0,
        assignee: '',
        issue_id: '',
        status: '',
        author: '',
      };

      const result = (commentLensProvider as any).shouldDisplayInline(comment);
      assert.strictEqual(result, true, 'Comment with empty string status should be displayed inline');
    });

    test('should return true for comment with whitespace-only status', () => {
      const comment: CsvEntry = {
        sha: 'abc123',
        filename: 'test.ts',
        url: 'https://example.com',
        lines: '1:0-5:0',
        title: 'Test Comment',
        comment: 'This is a test',
        priority: 1,
        category: 'Bug',
        additional: '',
        id: '123e4567-e89b-12d3-a456-426614174000',
        private: 0,
        assignee: '',
        issue_id: '',
        status: '   ',
        author: '',
      };

      const result = (commentLensProvider as any).shouldDisplayInline(comment);
      assert.strictEqual(result, true, 'Comment with whitespace-only status should be displayed inline');
    });

    test('should perform case-insensitive comparison', () => {
      const closedLowerCase: CsvEntry = {
        sha: 'abc123',
        filename: 'test.ts',
        url: 'https://example.com',
        lines: '1:0-5:0',
        title: 'Test Comment',
        comment: 'This is a test',
        priority: 1,
        category: 'Bug',
        additional: '',
        id: '123e4567-e89b-12d3-a456-426614174000',
        private: 0,
        assignee: '',
        issue_id: '',
        status: 'closed',
        author: '',
      };

      const closedUpperCase: CsvEntry = {
        ...closedLowerCase,
        status: 'CLOSED',
      };

      const closedMixedCase: CsvEntry = {
        ...closedLowerCase,
        status: 'ClOsEd',
      };

      assert.strictEqual(
        (commentLensProvider as any).shouldDisplayInline(closedLowerCase),
        false,
        'Comment with status "closed" should not be displayed',
      );
      assert.strictEqual(
        (commentLensProvider as any).shouldDisplayInline(closedUpperCase),
        false,
        'Comment with status "CLOSED" should not be displayed',
      );
      assert.strictEqual(
        (commentLensProvider as any).shouldDisplayInline(closedMixedCase),
        false,
        'Comment with status "ClOsEd" should not be displayed',
      );
    });
  });
});
