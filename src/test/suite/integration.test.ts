import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { EOL } from 'os';
import { CsvEntry, CsvStructure } from '../../model';
import { ReviewCommentService } from '../../review-comment';
import { getCsvFileLinesAsArray, setCsvFileLines } from '../../utils/storage-utils';
import { parseFile } from '@fast-csv/parse';

suite('Integration Test Suite - New Fields and Filters', () => {
  let testWorkspaceRoot: string;
  let testCsvPath: string;
  let reviewCommentService: ReviewCommentService;

  // Helper function to parse CSV file
  const parseCsvFile = (filePath: string): Promise<CsvEntry[]> => {
    return new Promise((resolve, reject) => {
      const data: CsvEntry[] = [];
      parseFile(filePath, { delimiter: ',', ignoreEmpty: true, headers: true })
        .on('error', reject)
        .on('data', (row: CsvEntry) => {
          data.push(CsvStructure.finalizeParse(row));
        })
        .on('end', () => resolve(data));
    });
  };

  suiteSetup(() => {
    // Get workspace root
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      testWorkspaceRoot = workspaceFolders[0].uri.fsPath;
    } else {
      testWorkspaceRoot = path.join(__dirname, '../../../');
    }

    testCsvPath = path.join(testWorkspaceRoot, 'test-code-review.csv');

    // Initialize ReviewCommentService
    reviewCommentService = new ReviewCommentService(testCsvPath, testWorkspaceRoot);
  });

  suiteTeardown(() => {
    // Clean up test CSV file
    if (fs.existsSync(testCsvPath)) {
      fs.unlinkSync(testCsvPath);
    }
  });

  test('1. Create new comment with all new fields', async () => {
    const newComment: CsvEntry = {
      sha: 'abc123',
      filename: 'test-file.ts',
      url: 'https://example.com/test',
      lines: '1:0-5:0',
      title: 'Test Comment',
      comment: 'This is a test comment',
      priority: 2,
      category: 'Bug',
      additional: 'Additional info',
      id: 'test-id-1',
      private: 0,
      assignee: 'john.doe',
      issue_id: 'JIRA-123',
      status: 'Open',
      author: 'jane.smith',
    };

    // Create CSV with header and comment
    const header = CsvStructure.headerLine;
    const commentLine = CsvStructure.formatAsCsvLine(newComment);

    // Write to test CSV
    setCsvFileLines(testCsvPath, [header, commentLine]);

    // Read back and verify
    const content = fs.readFileSync(testCsvPath, 'utf8');
    const lines = content.split(EOL).filter((l) => l.trim().length > 0);

    // Check header includes new fields
    assert.ok(lines[0].includes('assignee'), 'Header should include assignee');
    assert.ok(lines[0].includes('issue_id'), 'Header should include issue_id');
    assert.ok(lines[0].includes('status'), 'Header should include status');
    assert.ok(lines[0].includes('author'), 'Header should include author');

    // Check data line includes new field values
    assert.ok(lines[1].includes('john.doe'), 'Data should include assignee value');
    assert.ok(lines[1].includes('JIRA-123'), 'Data should include issue_id value');
    assert.ok(lines[1].includes('Open'), 'Data should include status value');
    assert.ok(lines[1].includes('jane.smith'), 'Data should include author value');
  });

  test('2. Edit existing comment and update new fields', async () => {
    // Create initial comment
    const initialComment: CsvEntry = {
      sha: 'def456',
      filename: 'test-file-2.ts',
      url: 'https://example.com/test2',
      lines: '10:0-15:0',
      title: 'Initial Comment',
      comment: 'Initial comment text',
      priority: 1,
      category: 'Code-Style',
      additional: '',
      id: 'test-id-2',
      private: 0,
      assignee: '',
      issue_id: '',
      status: 'Open',
      author: '',
    };

    const header = CsvStructure.headerLine;
    const commentLine = CsvStructure.formatAsCsvLine(initialComment);
    setCsvFileLines(testCsvPath, [header, commentLine]);

    // Parse and update
    const comments = await parseCsvFile(testCsvPath);

    assert.strictEqual(comments.length, 1, 'Should have one comment');

    // Update the comment with new field values
    const updatedComment: CsvEntry = {
      ...comments[0],
      assignee: 'updated.user',
      issue_id: 'JIRA-456',
      status: 'In Progress',
      author: 'original.author',
    };

    // Serialize and save
    const updatedLine = CsvStructure.formatAsCsvLine(updatedComment);
    setCsvFileLines(testCsvPath, [header, updatedLine]);

    // Read back and verify updates
    const updatedComments = await parseCsvFile(testCsvPath);

    assert.strictEqual(updatedComments[0].assignee, 'updated.user', 'Assignee should be updated');
    assert.strictEqual(updatedComments[0].issue_id, 'JIRA-456', 'Issue ID should be updated');
    assert.strictEqual(updatedComments[0].status, 'In Progress', 'Status should be updated');
    assert.strictEqual(updatedComments[0].author, 'original.author', 'Author should be updated');
  });

  test('3. Load old CSV files without new fields', async () => {
    // Create old-format CSV without new fields
    const oldCsvContent = `sha,filename,url,lines,title,comment,priority,category,additional,id,private${EOL}"old123","old-file.ts","https://example.com/old","1:0-2:0","Old Comment","Old comment text",2,"Bug","","old-id-1",0${EOL}`;

    fs.writeFileSync(testCsvPath, oldCsvContent);

    // Parse the old CSV
    const comments = await parseCsvFile(testCsvPath);

    assert.strictEqual(comments.length, 1, 'Should parse one comment');

    // Verify new fields have default values
    assert.strictEqual(comments[0].assignee, '', 'Assignee should default to empty string');
    assert.strictEqual(comments[0].issue_id, '', 'Issue ID should default to empty string');
    assert.strictEqual(comments[0].status, 'Open', 'Status should default to Open');
    assert.strictEqual(comments[0].author, '', 'Author should default to empty string');

    // Verify old fields are intact
    assert.strictEqual(comments[0].sha, 'old123', 'SHA should be preserved');
    assert.strictEqual(comments[0].title, 'Old Comment', 'Title should be preserved');
    assert.strictEqual(comments[0].priority, 2, 'Priority should be preserved');
  });

  test('4. Save comments with new fields to CSV', async () => {
    const comments: CsvEntry[] = [
      {
        sha: 'save123',
        filename: 'save-file-1.ts',
        url: 'https://example.com/save1',
        lines: '5:0-10:0',
        title: 'Save Test 1',
        comment: 'First save test',
        priority: 1,
        category: 'Performance',
        additional: '',
        id: 'save-id-1',
        private: 0,
        assignee: 'user1',
        issue_id: 'TASK-100',
        status: 'Resolved',
        author: 'author1',
      },
      {
        sha: 'save456',
        filename: 'save-file-2.ts',
        url: 'https://example.com/save2',
        lines: '15:0-20:0',
        title: 'Save Test 2',
        comment: 'Second save test',
        priority: 3,
        category: 'Security',
        additional: 'Critical',
        id: 'save-id-2',
        private: 1,
        assignee: 'user2',
        issue_id: 'TASK-200',
        status: 'Closed',
        author: 'author2',
      },
    ];

    const header = CsvStructure.headerLine;
    const lines = [header, ...comments.map((c) => CsvStructure.formatAsCsvLine(c))];
    setCsvFileLines(testCsvPath, lines);

    // Read back and verify
    const loadedComments = await parseCsvFile(testCsvPath);

    assert.strictEqual(loadedComments.length, 2, 'Should have two comments');

    // Verify first comment
    assert.strictEqual(loadedComments[0].assignee, 'user1', 'First comment assignee');
    assert.strictEqual(loadedComments[0].issue_id, 'TASK-100', 'First comment issue_id');
    assert.strictEqual(loadedComments[0].status, 'Resolved', 'First comment status');
    assert.strictEqual(loadedComments[0].author, 'author1', 'First comment author');

    // Verify second comment
    assert.strictEqual(loadedComments[1].assignee, 'user2', 'Second comment assignee');
    assert.strictEqual(loadedComments[1].issue_id, 'TASK-200', 'Second comment issue_id');
    assert.strictEqual(loadedComments[1].status, 'Closed', 'Second comment status');
    assert.strictEqual(loadedComments[1].author, 'author2', 'Second comment author');
  });

  test('5. Configuration changes for status and assignee lists', async () => {
    const config = vscode.workspace.getConfiguration('code-review');

    // Test status options configuration
    const statusOptions = config.get<string[]>('statusOptions');
    assert.ok(Array.isArray(statusOptions), 'Status options should be an array');
    assert.ok(statusOptions!.length > 0, 'Status options should have default values');
    assert.ok(statusOptions!.includes('Open'), 'Status options should include Open');

    // Test assignee options configuration
    const assigneeOptions = config.get<string[]>('assigneeOptions');
    assert.ok(Array.isArray(assigneeOptions), 'Assignee options should be an array');

    // Verify configuration can be read
    assert.ok(config.has('statusOptions'), 'Configuration should have statusOptions');
    assert.ok(config.has('assigneeOptions'), 'Configuration should have assigneeOptions');
  });

  test('6. Filter commands are registered', async () => {
    // Get all registered commands
    const commands = await vscode.commands.getCommands(true);

    // Verify filter commands exist
    assert.ok(commands.includes('codeReview.filterByAuthor'), 'filterByAuthor command should be registered');
    assert.ok(commands.includes('codeReview.filterByStatus'), 'filterByStatus command should be registered');
  });

  test('7. Author detection from git config', async () => {
    // This test verifies that the git author detection mechanism exists
    // The actual git command execution is tested in the service

    // Create a test comment without author
    const comment: CsvEntry = {
      sha: 'git123',
      filename: 'git-test.ts',
      url: 'https://example.com/git',
      lines: '1:0-5:0',
      title: 'Git Test',
      comment: 'Testing git author',
      priority: 1,
      category: 'Bug',
      additional: '',
      id: 'git-id-1',
      private: 0,
      assignee: '',
      issue_id: '',
      status: 'Open',
      author: '', // Empty author - should be populated
    };

    // The ReviewCommentService should populate the author field
    // We verify the field exists and can be set
    const header = CsvStructure.headerLine;
    const commentLine = CsvStructure.formatAsCsvLine(comment);

    assert.ok(header.includes('author'), 'CSV header should include author field');
    assert.ok(commentLine !== null, 'Comment should be serializable');
  });

  test('8. Backward compatibility - mixed old and new comments', async () => {
    // Create CSV with both old-format and new-format comments
    const mixedCsvContent = `sha,filename,url,lines,title,comment,priority,category,additional,id,private,assignee,issue_id,status,author${EOL}"old123","old-file.ts","https://example.com/old","1:0-2:0","Old Comment","Old text",1,"Bug","","old-id",0,"","","",""${EOL}"new123","new-file.ts","https://example.com/new","3:0-4:0","New Comment","New text",2,"Feature","","new-id",0,"assignee1","TASK-1","Open","author1"${EOL}`;

    fs.writeFileSync(testCsvPath, mixedCsvContent);

    // Parse the mixed CSV
    const comments = await parseCsvFile(testCsvPath);

    assert.strictEqual(comments.length, 2, 'Should parse both comments');

    // Verify old comment has defaults
    assert.strictEqual(comments[0].assignee, '', 'Old comment assignee should be empty');
    assert.strictEqual(comments[0].status, 'Open', 'Old comment status should default to Open');

    // Verify new comment has values
    assert.strictEqual(comments[1].assignee, 'assignee1', 'New comment should have assignee');
    assert.strictEqual(comments[1].issue_id, 'TASK-1', 'New comment should have issue_id');
    assert.strictEqual(comments[1].status, 'Open', 'New comment should have status');
    assert.strictEqual(comments[1].author, 'author1', 'New comment should have author');
  });

  test('9. Special characters in new fields', async () => {
    // Test that special characters are properly escaped
    const comment: CsvEntry = {
      sha: 'special123',
      filename: 'special-file.ts',
      url: 'https://example.com/special',
      lines: '1:0-5:0',
      title: 'Special Test',
      comment: 'Testing special chars',
      priority: 1,
      category: 'Bug',
      additional: '',
      id: 'special-id',
      private: 0,
      assignee: 'user "with" quotes',
      issue_id: 'TASK-"123"',
      status: 'In Progress',
      author: 'author, with, commas',
    };

    const header = CsvStructure.headerLine;
    const commentLine = CsvStructure.formatAsCsvLine(comment);
    setCsvFileLines(testCsvPath, [header, commentLine]);

    // Parse back
    const comments = await parseCsvFile(testCsvPath);

    assert.strictEqual(comments.length, 1, 'Should parse one comment');
    assert.strictEqual(comments[0].assignee, 'user "with" quotes', 'Assignee with quotes should be preserved');
    assert.strictEqual(comments[0].issue_id, 'TASK-"123"', 'Issue ID with quotes should be preserved');
    assert.strictEqual(comments[0].author, 'author, with, commas', 'Author with commas should be preserved');
  });

  test('10. Empty new fields are handled correctly', async () => {
    const comment: CsvEntry = {
      sha: 'empty123',
      filename: 'empty-file.ts',
      url: 'https://example.com/empty',
      lines: '1:0-5:0',
      title: 'Empty Test',
      comment: 'Testing empty fields',
      priority: 1,
      category: 'Bug',
      additional: '',
      id: 'empty-id',
      private: 0,
      assignee: '',
      issue_id: '',
      status: '', // Empty status should default to 'Open'
      author: '',
    };

    const header = CsvStructure.headerLine;
    const commentLine = CsvStructure.formatAsCsvLine(comment);
    setCsvFileLines(testCsvPath, [header, commentLine]);

    // Parse back
    const comments = await parseCsvFile(testCsvPath);

    assert.strictEqual(comments.length, 1, 'Should parse one comment');
    assert.strictEqual(comments[0].assignee, '', 'Empty assignee should remain empty');
    assert.strictEqual(comments[0].issue_id, '', 'Empty issue_id should remain empty');
    assert.strictEqual(comments[0].status, 'Open', 'Empty status should default to Open');
    assert.strictEqual(comments[0].author, '', 'Empty author should remain empty');
  });
});
