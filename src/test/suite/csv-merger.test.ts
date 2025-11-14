import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { CSVMerger } from '../../utils/csv-merger';
import { CsvEntry } from '../../model';

suite('CSV Merger Test Suite', () => {
  const testWorkspaceRoot = path.join(__dirname, '..', '..', '..', 'test-workspace');
  const testCsvFile = path.join(testWorkspaceRoot, 'test-merge.csv');

  // Clean up test files before and after tests
  setup(() => {
    if (!fs.existsSync(testWorkspaceRoot)) {
      fs.mkdirSync(testWorkspaceRoot, { recursive: true });
    }
  });

  teardown(() => {
    if (fs.existsSync(testCsvFile)) {
      fs.unlinkSync(testCsvFile);
    }
  });

  suite('readExisting', () => {
    test('should return empty array when file does not exist', async () => {
      const merger = new CSVMerger(testCsvFile);
      const existing = await merger.readExisting();
      assert.strictEqual(existing.length, 0);
    });

    test('should read existing comments from CSV file', async () => {
      // Create a test CSV file
      const csvContent = `sha,filename,url,lines,title,comment,priority,category,additional,id,private,assignee,issue_id,status,author
"abc123","test.ts","https://example.com","1:0-5:0","Test","Test comment",1,"Bug","","test-id-1",0,"","","Open",""`;
      fs.writeFileSync(testCsvFile, csvContent);

      const merger = new CSVMerger(testCsvFile);
      const existing = await merger.readExisting();

      assert.strictEqual(existing.length, 1);
      assert.strictEqual(existing[0].id, 'test-id-1');
      assert.strictEqual(existing[0].filename, 'test.ts');
      assert.strictEqual(existing[0].title, 'Test');
    });

    test('should handle CSV with multiple comments', async () => {
      const csvContent = `sha,filename,url,lines,title,comment,priority,category,additional,id,private,assignee,issue_id,status,author
"abc123","test1.ts","https://example.com","1:0-5:0","Test 1","Comment 1",1,"Bug","","test-id-1",0,"","","Open",""
"def456","test2.ts","https://example.com","10:0-15:0","Test 2","Comment 2",2,"Security","","test-id-2",0,"john","JIRA-1","In Progress","jane"`;
      fs.writeFileSync(testCsvFile, csvContent);

      const merger = new CSVMerger(testCsvFile);
      const existing = await merger.readExisting();

      assert.strictEqual(existing.length, 2);
      assert.strictEqual(existing[0].id, 'test-id-1');
      assert.strictEqual(existing[1].id, 'test-id-2');
      assert.strictEqual(existing[1].assignee, 'john');
      assert.strictEqual(existing[1].issue_id, 'JIRA-1');
    });
  });

  suite('mergeComments', () => {
    test('should merge new comments with empty existing array', () => {
      const merger = new CSVMerger(testCsvFile);
      const existing: CsvEntry[] = [];
      const newComments: CsvEntry[] = [
        {
          sha: 'abc123',
          filename: 'test.ts',
          url: 'https://example.com',
          lines: '1:0-5:0',
          title: 'Test',
          comment: 'Test comment',
          priority: 1,
          category: 'Bug',
          additional: '',
          id: 'new-id-1',
          private: 0,
          assignee: '',
          issue_id: '',
          status: 'Open',
          author: '',
        },
      ];

      const result = merger.mergeComments(existing, newComments);

      assert.strictEqual(result.merged.length, 1);
      assert.strictEqual(result.skippedDuplicates, 0);
      assert.strictEqual(result.merged[0].id, 'new-id-1');
    });

    test('should filter out duplicate comments by ID', () => {
      const merger = new CSVMerger(testCsvFile);
      const existing: CsvEntry[] = [
        {
          sha: 'abc123',
          filename: 'test.ts',
          url: 'https://example.com',
          lines: '1:0-5:0',
          title: 'Existing',
          comment: 'Existing comment',
          priority: 1,
          category: 'Bug',
          additional: '',
          id: 'duplicate-id',
          private: 0,
          assignee: '',
          issue_id: '',
          status: 'Open',
          author: '',
        },
      ];

      const newComments: CsvEntry[] = [
        {
          sha: 'def456',
          filename: 'test2.ts',
          url: 'https://example.com',
          lines: '10:0-15:0',
          title: 'Duplicate',
          comment: 'This should be skipped',
          priority: 2,
          category: 'Security',
          additional: '',
          id: 'duplicate-id',
          private: 0,
          assignee: '',
          issue_id: '',
          status: 'Open',
          author: '',
        },
        {
          sha: 'ghi789',
          filename: 'test3.ts',
          url: 'https://example.com',
          lines: '20:0-25:0',
          title: 'New',
          comment: 'This should be added',
          priority: 1,
          category: 'Performance',
          additional: '',
          id: 'new-id',
          private: 0,
          assignee: '',
          issue_id: '',
          status: 'Open',
          author: '',
        },
      ];

      const result = merger.mergeComments(existing, newComments);

      assert.strictEqual(result.merged.length, 2);
      assert.strictEqual(result.skippedDuplicates, 1);
      assert.strictEqual(result.merged[0].id, 'duplicate-id');
      assert.strictEqual(result.merged[1].id, 'new-id');
    });

    test('should prevent duplicates within new comments array', () => {
      const merger = new CSVMerger(testCsvFile);
      const existing: CsvEntry[] = [];
      const newComments: CsvEntry[] = [
        {
          sha: 'abc123',
          filename: 'test.ts',
          url: 'https://example.com',
          lines: '1:0-5:0',
          title: 'First',
          comment: 'First occurrence',
          priority: 1,
          category: 'Bug',
          additional: '',
          id: 'same-id',
          private: 0,
          assignee: '',
          issue_id: '',
          status: 'Open',
          author: '',
        },
        {
          sha: 'def456',
          filename: 'test2.ts',
          url: 'https://example.com',
          lines: '10:0-15:0',
          title: 'Second',
          comment: 'Second occurrence (duplicate)',
          priority: 2,
          category: 'Security',
          additional: '',
          id: 'same-id',
          private: 0,
          assignee: '',
          issue_id: '',
          status: 'Open',
          author: '',
        },
      ];

      const result = merger.mergeComments(existing, newComments);

      assert.strictEqual(result.merged.length, 1);
      assert.strictEqual(result.skippedDuplicates, 1);
      assert.strictEqual(result.merged[0].title, 'First');
    });

    test('should handle large number of comments efficiently', () => {
      const merger = new CSVMerger(testCsvFile);
      const existing: CsvEntry[] = [];

      // Create 1000 new comments
      const newComments: CsvEntry[] = [];
      for (let i = 0; i < 1000; i++) {
        newComments.push({
          sha: `sha-${i}`,
          filename: `test-${i}.ts`,
          url: 'https://example.com',
          lines: '1:0-5:0',
          title: `Test ${i}`,
          comment: `Comment ${i}`,
          priority: 1,
          category: 'Bug',
          additional: '',
          id: `id-${i}`,
          private: 0,
          assignee: '',
          issue_id: '',
          status: 'Open',
          author: '',
        });
      }

      const startTime = Date.now();
      const result = merger.mergeComments(existing, newComments);
      const endTime = Date.now();

      assert.strictEqual(result.merged.length, 1000);
      assert.strictEqual(result.skippedDuplicates, 0);
      // Should complete in reasonable time (< 100ms for 1000 items)
      assert.ok(endTime - startTime < 100, `Merge took ${endTime - startTime}ms, expected < 100ms`);
    });
  });

  suite('writeComments', () => {
    test('should write comments to CSV file', async () => {
      const merger = new CSVMerger(testCsvFile);
      const comments: CsvEntry[] = [
        {
          sha: 'abc123',
          filename: 'test.ts',
          url: 'https://example.com',
          lines: '1:0-5:0',
          title: 'Test',
          comment: 'Test comment',
          priority: 1,
          category: 'Bug',
          additional: '',
          id: 'test-id-1',
          private: 0,
          assignee: 'john',
          issue_id: 'JIRA-123',
          status: 'Open',
          author: 'jane',
        },
      ];

      const success = await merger.writeComments(comments);
      assert.strictEqual(success, true);

      // Verify file was created
      assert.ok(fs.existsSync(testCsvFile));

      // Verify content
      const content = fs.readFileSync(testCsvFile, 'utf8');
      assert.ok(content.includes('test-id-1'));
      assert.ok(content.includes('test.ts'));
      assert.ok(content.includes('john'));
      assert.ok(content.includes('JIRA-123'));
    });

    test('should write multiple comments correctly', async () => {
      const merger = new CSVMerger(testCsvFile);
      const comments: CsvEntry[] = [
        {
          sha: 'abc123',
          filename: 'test1.ts',
          url: 'https://example.com',
          lines: '1:0-5:0',
          title: 'Test 1',
          comment: 'Comment 1',
          priority: 1,
          category: 'Bug',
          additional: '',
          id: 'test-id-1',
          private: 0,
          assignee: '',
          issue_id: '',
          status: 'Open',
          author: '',
        },
        {
          sha: 'def456',
          filename: 'test2.ts',
          url: 'https://example.com',
          lines: '10:0-15:0',
          title: 'Test 2',
          comment: 'Comment 2',
          priority: 2,
          category: 'Security',
          additional: '',
          id: 'test-id-2',
          private: 0,
          assignee: 'john',
          issue_id: 'JIRA-456',
          status: 'In Progress',
          author: 'jane',
        },
      ];

      const success = await merger.writeComments(comments);
      assert.strictEqual(success, true);

      // Read back and verify
      const readBack = await merger.readExisting();
      assert.strictEqual(readBack.length, 2);
      assert.strictEqual(readBack[0].id, 'test-id-1');
      assert.strictEqual(readBack[1].id, 'test-id-2');
      assert.strictEqual(readBack[1].assignee, 'john');
    });
  });
});
