import * as assert from 'assert';
import { TreeItemCollapsibleState } from 'vscode';
import { CommentListEntry } from '../../comment-list-entry';
import { ReviewFileExportSection } from '../../interfaces';

suite('CommentListEntry', () => {
  const mockData: ReviewFileExportSection = {
    group: 'test-file.ts',
    lines: [],
  };

  suite('Assignee Display', () => {
    test('should display assignee in description when assignee is provided', () => {
      const entry = new CommentListEntry(
        'test-id',
        'Test Comment',
        'This is a test comment',
        'Hover text',
        TreeItemCollapsibleState.None,
        mockData,
        2, // priority
        0, // private
        'john.doe', // assignee
        'ISSUE-123', // issue_id
        'Open', // status
        'jane.smith', // author
      );

      const description = entry.description;
      assert.ok(description.includes('@john.doe'), 'Description should include assignee with @ prefix');
      assert.ok(description.includes('[Open]'), 'Description should include status');
    });

    test('should not display assignee in description when assignee is empty', () => {
      const entry = new CommentListEntry(
        'test-id',
        'Test Comment',
        'This is a test comment',
        'Hover text',
        TreeItemCollapsibleState.None,
        mockData,
        2, // priority
        0, // private
        '', // assignee (empty)
        'ISSUE-123', // issue_id
        'Open', // status
        'jane.smith', // author
      );

      const description = entry.description;
      assert.ok(!description.includes('@'), 'Description should not include @ when assignee is empty');
      assert.ok(description.includes('[Open]'), 'Description should still include status');
    });

    test('should not display assignee in description when assignee is undefined', () => {
      const entry = new CommentListEntry(
        'test-id',
        'Test Comment',
        'This is a test comment',
        'Hover text',
        TreeItemCollapsibleState.None,
        mockData,
        2, // priority
        0, // private
        undefined, // assignee (undefined)
        'ISSUE-123', // issue_id
        'Open', // status
        'jane.smith', // author
      );

      const description = entry.description;
      assert.ok(!description.includes('@'), 'Description should not include @ when assignee is undefined');
    });

    test('should display assignee in tooltip when assignee is provided', () => {
      const entry = new CommentListEntry(
        'test-id',
        'Test Comment',
        'This is a test comment',
        'Hover text',
        TreeItemCollapsibleState.None,
        mockData,
        2, // priority
        0, // private
        'john.doe', // assignee
        'ISSUE-123', // issue_id
        'Open', // status
        'jane.smith', // author
      );

      const tooltip = entry.tooltip;
      assert.ok(tooltip.includes('Assignee: john.doe'), 'Tooltip should include assignee with label');
      assert.ok(tooltip.includes('Status: Open'), 'Tooltip should include status');
      assert.ok(tooltip.includes('Author: jane.smith'), 'Tooltip should include author');
      assert.ok(tooltip.includes('Issue ID: ISSUE-123'), 'Tooltip should include issue ID');
    });

    test('should not display assignee in tooltip when assignee is empty', () => {
      const entry = new CommentListEntry(
        'test-id',
        'Test Comment',
        'This is a test comment',
        'Hover text',
        TreeItemCollapsibleState.None,
        mockData,
        2, // priority
        0, // private
        '', // assignee (empty)
        'ISSUE-123', // issue_id
        'Open', // status
        'jane.smith', // author
      );

      const tooltip = entry.tooltip;
      assert.ok(!tooltip.includes('Assignee:'), 'Tooltip should not include assignee label when empty');
      assert.ok(tooltip.includes('Status: Open'), 'Tooltip should still include status');
    });

    test('should display both status and assignee in correct order in description', () => {
      const entry = new CommentListEntry(
        'test-id',
        'Test Comment',
        'This is a test comment text',
        'Hover text',
        TreeItemCollapsibleState.None,
        mockData,
        2, // priority
        0, // private
        'john.doe', // assignee
        'ISSUE-123', // issue_id
        'In Progress', // status
        'jane.smith', // author
      );

      const description = entry.description;
      // Status should come before assignee
      const statusIndex = description.indexOf('[In Progress]');
      const assigneeIndex = description.indexOf('@john.doe');
      assert.ok(statusIndex < assigneeIndex, 'Status should appear before assignee in description');
      assert.ok(description.includes('This is a test comment text'), 'Description should include comment text');
    });

    test('should handle special characters in assignee name', () => {
      const entry = new CommentListEntry(
        'test-id',
        'Test Comment',
        'This is a test comment',
        'Hover text',
        TreeItemCollapsibleState.None,
        mockData,
        2, // priority
        0, // private
        'john.doe-smith', // assignee with special characters
        'ISSUE-123', // issue_id
        'Open', // status
        'jane.smith', // author
      );

      const description = entry.description;
      assert.ok(description.includes('@john.doe-smith'), 'Description should handle special characters in assignee');

      const tooltip = entry.tooltip;
      assert.ok(tooltip.includes('Assignee: john.doe-smith'), 'Tooltip should handle special characters in assignee');
    });
  });
});
