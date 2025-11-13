import * as assert from 'assert';
import { CsvEntry, CsvStructure, createCommentFromObject } from '../../model';

suite('Model - Data Model Changes', () => {
  suite('CsvStructure - Serialization of new fields', () => {
    test('should serialize assignee field correctly', () => {
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
        assignee: 'john.doe',
        issue_id: 'JIRA-123',
        status: 'Open',
        author: 'jane.smith',
      };

      const csvLine = CsvStructure.formatAsCsvLine(comment);
      assert.ok(csvLine.includes('"john.doe"'), 'CSV line should contain assignee');
    });

    test('should serialize issue_id field correctly', () => {
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
        assignee: 'john.doe',
        issue_id: 'JIRA-123',
        status: 'Open',
        author: 'jane.smith',
      };

      const csvLine = CsvStructure.formatAsCsvLine(comment);
      assert.ok(csvLine.includes('"JIRA-123"'), 'CSV line should contain issue_id');
    });

    test('should serialize status field correctly', () => {
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
        assignee: 'john.doe',
        issue_id: 'JIRA-123',
        status: 'In Progress',
        author: 'jane.smith',
      };

      const csvLine = CsvStructure.formatAsCsvLine(comment);
      assert.ok(csvLine.includes('"In Progress"'), 'CSV line should contain status');
    });

    test('should serialize author field correctly', () => {
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
        assignee: 'john.doe',
        issue_id: 'JIRA-123',
        status: 'Open',
        author: 'jane.smith',
      };

      const csvLine = CsvStructure.formatAsCsvLine(comment);
      assert.ok(csvLine.includes('"jane.smith"'), 'CSV line should contain author');
    });

    test('should serialize empty new fields as empty strings', () => {
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

      const csvLine = CsvStructure.formatAsCsvLine(comment);
      const parts = csvLine.split(',');
      // Check that empty fields are serialized as ""
      assert.ok(csvLine.includes('""'), 'CSV line should contain empty string fields');
    });

    test('should escape special characters in new fields', () => {
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
        assignee: 'John "Johnny" Doe',
        issue_id: 'JIRA-123',
        status: 'Open',
        author: 'Jane Smith',
      };

      const csvLine = CsvStructure.formatAsCsvLine(comment);
      assert.ok(csvLine.includes('John ""Johnny"" Doe'), 'CSV line should escape double quotes in assignee');
    });
  });

  suite('CsvStructure - Default value generation', () => {
    test('should generate empty string default for assignee', () => {
      const defaultValue = CsvStructure.getDefaultValue('assignee');
      assert.strictEqual(defaultValue, '', 'Default assignee should be empty string');
    });

    test('should generate empty string default for issue_id', () => {
      const defaultValue = CsvStructure.getDefaultValue('issue_id');
      assert.strictEqual(defaultValue, '', 'Default issue_id should be empty string');
    });

    test('should generate "Open" default for status', () => {
      const defaultValue = CsvStructure.getDefaultValue('status');
      assert.strictEqual(defaultValue, 'Open', 'Default status should be "Open"');
    });

    test('should generate empty string default for author', () => {
      const defaultValue = CsvStructure.getDefaultValue('author');
      assert.strictEqual(defaultValue, '', 'Default author should be empty string');
    });
  });

  suite('CsvStructure - finalizeParse with backward compatibility', () => {
    test('should handle comment with all new fields present', () => {
      const comment: any = {
        sha: 'abc123',
        filename: 'test.ts',
        url: 'https://example.com',
        lines: '1:0-5:0',
        title: 'Test Comment',
        comment: 'This is a test',
        priority: '1',
        category: 'Bug',
        additional: '',
        id: '123e4567-e89b-12d3-a456-426614174000',
        private: '0',
        assignee: 'john.doe',
        issue_id: 'JIRA-123',
        status: 'In Progress',
        author: 'jane.smith',
      };

      const finalized = CsvStructure.finalizeParse(comment);
      assert.strictEqual(finalized.assignee, 'john.doe', 'Assignee should be preserved');
      assert.strictEqual(finalized.issue_id, 'JIRA-123', 'Issue ID should be preserved');
      assert.strictEqual(finalized.status, 'In Progress', 'Status should be preserved');
      assert.strictEqual(finalized.author, 'jane.smith', 'Author should be preserved');
    });

    test('should handle comment with missing assignee field', () => {
      const comment: any = {
        sha: 'abc123',
        filename: 'test.ts',
        url: 'https://example.com',
        lines: '1:0-5:0',
        title: 'Test Comment',
        comment: 'This is a test',
        priority: '1',
        category: 'Bug',
        additional: '',
        id: '123e4567-e89b-12d3-a456-426614174000',
        private: '0',
        issue_id: 'JIRA-123',
        status: 'Open',
        author: 'jane.smith',
      };

      const finalized = CsvStructure.finalizeParse(comment);
      assert.strictEqual(finalized.assignee, '', 'Missing assignee should default to empty string');
      assert.strictEqual(finalized.issue_id, 'JIRA-123', 'Issue ID should be preserved');
      assert.strictEqual(finalized.status, 'Open', 'Status should be preserved');
      assert.strictEqual(finalized.author, 'jane.smith', 'Author should be preserved');
    });

    test('should handle comment with missing issue_id field', () => {
      const comment: any = {
        sha: 'abc123',
        filename: 'test.ts',
        url: 'https://example.com',
        lines: '1:0-5:0',
        title: 'Test Comment',
        comment: 'This is a test',
        priority: '1',
        category: 'Bug',
        additional: '',
        id: '123e4567-e89b-12d3-a456-426614174000',
        private: '0',
        assignee: 'john.doe',
        status: 'Open',
        author: 'jane.smith',
      };

      const finalized = CsvStructure.finalizeParse(comment);
      assert.strictEqual(finalized.assignee, 'john.doe', 'Assignee should be preserved');
      assert.strictEqual(finalized.issue_id, '', 'Missing issue_id should default to empty string');
      assert.strictEqual(finalized.status, 'Open', 'Status should be preserved');
      assert.strictEqual(finalized.author, 'jane.smith', 'Author should be preserved');
    });

    test('should handle comment with missing status field', () => {
      const comment: any = {
        sha: 'abc123',
        filename: 'test.ts',
        url: 'https://example.com',
        lines: '1:0-5:0',
        title: 'Test Comment',
        comment: 'This is a test',
        priority: '1',
        category: 'Bug',
        additional: '',
        id: '123e4567-e89b-12d3-a456-426614174000',
        private: '0',
        assignee: 'john.doe',
        issue_id: 'JIRA-123',
        author: 'jane.smith',
      };

      const finalized = CsvStructure.finalizeParse(comment);
      assert.strictEqual(finalized.assignee, 'john.doe', 'Assignee should be preserved');
      assert.strictEqual(finalized.issue_id, 'JIRA-123', 'Issue ID should be preserved');
      assert.strictEqual(finalized.status, 'Open', 'Missing status should default to "Open"');
      assert.strictEqual(finalized.author, 'jane.smith', 'Author should be preserved');
    });

    test('should handle comment with missing author field', () => {
      const comment: any = {
        sha: 'abc123',
        filename: 'test.ts',
        url: 'https://example.com',
        lines: '1:0-5:0',
        title: 'Test Comment',
        comment: 'This is a test',
        priority: '1',
        category: 'Bug',
        additional: '',
        id: '123e4567-e89b-12d3-a456-426614174000',
        private: '0',
        assignee: 'john.doe',
        issue_id: 'JIRA-123',
        status: 'Open',
      };

      const finalized = CsvStructure.finalizeParse(comment);
      assert.strictEqual(finalized.assignee, 'john.doe', 'Assignee should be preserved');
      assert.strictEqual(finalized.issue_id, 'JIRA-123', 'Issue ID should be preserved');
      assert.strictEqual(finalized.status, 'Open', 'Status should be preserved');
      assert.strictEqual(finalized.author, '', 'Missing author should default to empty string');
    });

    test('should handle comment with all new fields missing (backward compatibility)', () => {
      const comment: any = {
        sha: 'abc123',
        filename: 'test.ts',
        url: 'https://example.com',
        lines: '1:0-5:0',
        title: 'Test Comment',
        comment: 'This is a test',
        priority: '1',
        category: 'Bug',
        additional: '',
        id: '123e4567-e89b-12d3-a456-426614174000',
        private: '0',
      };

      const finalized = CsvStructure.finalizeParse(comment);
      assert.strictEqual(finalized.assignee, '', 'Missing assignee should default to empty string');
      assert.strictEqual(finalized.issue_id, '', 'Missing issue_id should default to empty string');
      assert.strictEqual(finalized.status, 'Open', 'Missing status should default to "Open"');
      assert.strictEqual(finalized.author, '', 'Missing author should default to empty string');
    });

    test('should handle comment with empty string values for new fields', () => {
      const comment: any = {
        sha: 'abc123',
        filename: 'test.ts',
        url: 'https://example.com',
        lines: '1:0-5:0',
        title: 'Test Comment',
        comment: 'This is a test',
        priority: '1',
        category: 'Bug',
        additional: '',
        id: '123e4567-e89b-12d3-a456-426614174000',
        private: '0',
        assignee: '',
        issue_id: '',
        status: '',
        author: '',
      };

      const finalized = CsvStructure.finalizeParse(comment);
      assert.strictEqual(finalized.assignee, '', 'Empty assignee should remain empty');
      assert.strictEqual(finalized.issue_id, '', 'Empty issue_id should remain empty');
      assert.strictEqual(finalized.status, 'Open', 'Empty status should default to "Open"');
      assert.strictEqual(finalized.author, '', 'Empty author should remain empty');
    });

    test('should convert priority and private to numbers', () => {
      const comment: any = {
        sha: 'abc123',
        filename: 'test.ts',
        url: 'https://example.com',
        lines: '1:0-5:0',
        title: 'Test Comment',
        comment: 'This is a test',
        priority: '2',
        category: 'Bug',
        additional: '',
        id: '123e4567-e89b-12d3-a456-426614174000',
        private: '1',
        assignee: 'john.doe',
        issue_id: 'JIRA-123',
        status: 'Open',
        author: 'jane.smith',
      };

      const finalized = CsvStructure.finalizeParse(comment);
      assert.strictEqual(typeof finalized.priority, 'number', 'Priority should be a number');
      assert.strictEqual(finalized.priority, 2, 'Priority should be 2');
      assert.strictEqual(typeof finalized.private, 'number', 'Private should be a number');
      assert.strictEqual(finalized.private, 1, 'Private should be 1');
    });
  });

  suite('createCommentFromObject - New fields initialization', () => {
    test('should initialize new fields with defaults when not present', () => {
      const obj = {
        sha: 'abc123',
        filename: 'test.ts',
        url: 'https://example.com',
        lines: '1:0-5:0',
        title: 'Test Comment',
        comment: 'This is a test',
        priority: 1,
        category: 'Bug',
        additional: '',
        private: 0,
      };

      const comment = createCommentFromObject(obj);
      assert.strictEqual(comment.assignee, '', 'Assignee should default to empty string');
      assert.strictEqual(comment.issue_id, '', 'Issue ID should default to empty string');
      assert.strictEqual(comment.status, 'Open', 'Status should default to "Open"');
      assert.strictEqual(comment.author, '', 'Author should default to empty string');
      assert.ok(comment.id, 'ID should be generated');
    });

    test('should preserve new fields when present', () => {
      const obj = {
        sha: 'abc123',
        filename: 'test.ts',
        url: 'https://example.com',
        lines: '1:0-5:0',
        title: 'Test Comment',
        comment: 'This is a test',
        priority: 1,
        category: 'Bug',
        additional: '',
        private: 0,
        assignee: 'john.doe',
        issue_id: 'JIRA-123',
        status: 'In Progress',
        author: 'jane.smith',
      };

      const comment = createCommentFromObject(obj);
      assert.strictEqual(comment.assignee, 'john.doe', 'Assignee should be preserved');
      assert.strictEqual(comment.issue_id, 'JIRA-123', 'Issue ID should be preserved');
      assert.strictEqual(comment.status, 'In Progress', 'Status should be preserved');
      assert.strictEqual(comment.author, 'jane.smith', 'Author should be preserved');
    });

    test('should handle JSON string input', () => {
      const obj = {
        sha: 'abc123',
        filename: 'test.ts',
        url: 'https://example.com',
        lines: '1:0-5:0',
        title: 'Test Comment',
        comment: 'This is a test',
        priority: 1,
        category: 'Bug',
        additional: '',
        private: 0,
        assignee: 'john.doe',
        issue_id: 'JIRA-123',
        status: 'Resolved',
        author: 'jane.smith',
      };

      const comment = createCommentFromObject(JSON.stringify(obj));
      assert.strictEqual(comment.assignee, 'john.doe', 'Assignee should be preserved from JSON string');
      assert.strictEqual(comment.issue_id, 'JIRA-123', 'Issue ID should be preserved from JSON string');
      assert.strictEqual(comment.status, 'Resolved', 'Status should be preserved from JSON string');
      assert.strictEqual(comment.author, 'jane.smith', 'Author should be preserved from JSON string');
    });
  });

  suite('CsvStructure - Header line includes new fields', () => {
    test('should include new fields in header line', () => {
      const headerLine = CsvStructure.headerLine;
      assert.ok(headerLine.includes('assignee'), 'Header should include assignee');
      assert.ok(headerLine.includes('issue_id'), 'Header should include issue_id');
      assert.ok(headerLine.includes('status'), 'Header should include status');
      assert.ok(headerLine.includes('author'), 'Header should include author');
    });

    test('should have new fields at the end of header line', () => {
      const headerLine = CsvStructure.headerLine;
      const headers = headerLine.split(',');
      const lastFourHeaders = headers.slice(-4);
      assert.deepStrictEqual(
        lastFourHeaders,
        ['assignee', 'issue_id', 'status', 'author'],
        'New fields should be at the end of header line',
      );
    });
  });
});
