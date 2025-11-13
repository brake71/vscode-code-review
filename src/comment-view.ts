import { ExtensionContext, TreeDataProvider, TreeItem, window, EventEmitter, Event } from 'vscode';
import { CommentListEntry } from './comment-list-entry';
import { ExportFactory } from './export-factory';

export class CommentView {
  constructor(private commentProvider: CommentsProvider) {
    window.createTreeView('code-review.list', {
      treeDataProvider: this.commentProvider,
      showCollapseAll: true,
    });
  }
}

export class CommentsProvider implements TreeDataProvider<CommentListEntry> {
  private _onDidChangeTreeData: EventEmitter<CommentListEntry | undefined> = new EventEmitter<
    CommentListEntry | undefined
  >();
  readonly onDidChangeTreeData: Event<CommentListEntry | undefined> = this._onDidChangeTreeData.event;

  // Filter state
  private filterByAuthor: string | null = null;
  private filterByStatus: string[] = [];

  constructor(private context: ExtensionContext, private exportFactory: ExportFactory) {}

  /**
   * Set filter by author
   * @param author The author to filter by, or null to clear the filter
   */
  setAuthorFilter(author: string | null): void {
    this.filterByAuthor = author;
    this.refresh();
  }

  /**
   * Set filter by status
   * @param statuses Array of statuses to filter by
   */
  setStatusFilter(statuses: string[]): void {
    this.filterByStatus = statuses;
    this.refresh();
  }

  /**
   * Clear all filters
   */
  clearFilters(): void {
    this.filterByAuthor = null;
    this.filterByStatus = [];
    this.refresh();
  }

  /**
   * Get current filter state
   * @returns Object containing current filter values
   */
  getActiveFilters(): { author: string | null; statuses: string[] } {
    return {
      author: this.filterByAuthor,
      statuses: this.filterByStatus,
    };
  }

  refresh(entry?: CommentListEntry): void {
    this._onDidChangeTreeData.fire(entry);
  }

  getTreeItem(element: CommentListEntry): TreeItem {
    return element;
  }

  getChildren(element?: CommentListEntry): Thenable<CommentListEntry[]> {
    // if no element, the first item level starts
    if (!element) {
      return this.exportFactory.getFilesContainingComments(this.filterByAuthor, this.filterByStatus);
    } else {
      return this.exportFactory.getComments(element, this.filterByAuthor, this.filterByStatus);
    }
  }
}
