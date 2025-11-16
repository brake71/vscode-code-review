import {
  ExtensionContext,
  TreeDataProvider,
  TreeItem,
  window,
  EventEmitter,
  Event,
  commands,
  ProgressLocation,
  StatusBarAlignment,
  StatusBarItem,
  TreeItemCollapsibleState,
  ThemeIcon,
} from 'vscode';
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
  private filterByAssignee: string | null = null;

  // Status bar item for comment count
  private statusBarItem: StatusBarItem;

  // GitLab sync timestamp
  private lastSyncTime: Date | null = null;

  constructor(private context: ExtensionContext, private exportFactory: ExportFactory) {
    this.restoreFilterState();
    this.restoreSyncTime();
    this.updateContextVariables();

    // Initialize status bar item
    this.statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 100);
    this.statusBarItem.command = 'code-review.list.focus';
    this.statusBarItem.show();
    this.updateStatusBar();
  }

  /**
   * Restore filter state from workspace state
   */
  private restoreFilterState(): void {
    const workspaceState = this.context.workspaceState;
    this.filterByAuthor = workspaceState.get('codeReview.filterByAuthor', null);
    this.filterByStatus = workspaceState.get('codeReview.filterByStatus', []);
    this.filterByAssignee = workspaceState.get('codeReview.filterByAssignee', null);
  }

  /**
   * Save filter state to workspace state
   */
  private saveFilterState(): void {
    const workspaceState = this.context.workspaceState;
    workspaceState.update('codeReview.filterByAuthor', this.filterByAuthor);
    workspaceState.update('codeReview.filterByStatus', this.filterByStatus);
    workspaceState.update('codeReview.filterByAssignee', this.filterByAssignee);
  }

  /**
   * Restore last sync time from workspace state
   */
  private restoreSyncTime(): void {
    const workspaceState = this.context.workspaceState;
    const syncTimeString = workspaceState.get<string | undefined>('codeReview.gitlab.lastSyncTime');
    if (syncTimeString) {
      this.lastSyncTime = new Date(syncTimeString);
    }
  }

  /**
   * Save last sync time to workspace state
   */
  private saveSyncTime(): void {
    const workspaceState = this.context.workspaceState;
    if (this.lastSyncTime) {
      workspaceState.update('codeReview.gitlab.lastSyncTime', this.lastSyncTime.toISOString());
    }
  }

  /**
   * Update last sync time and persist it
   * Should be called after successful GitLab sync
   */
  updateLastSyncTime(): void {
    this.lastSyncTime = new Date();
    this.saveSyncTime();
  }

  /**
   * Get last sync time
   * @returns Date of last sync or null if never synced
   */
  getLastSyncTime(): Date | null {
    return this.lastSyncTime;
  }

  /**
   * Set filter by author
   * @param author The author to filter by, or null to clear the filter
   */
  async setAuthorFilter(author: string | null): Promise<void> {
    this.filterByAuthor = author;
    this.saveFilterState();
    this.updateContextVariables();
    await this.refresh();
  }

  /**
   * Set filter by status
   * @param statuses Array of statuses to filter by
   */
  async setStatusFilter(statuses: string[]): Promise<void> {
    this.filterByStatus = statuses;
    this.saveFilterState();
    this.updateContextVariables();
    await this.refresh();
  }

  /**
   * Set filter by assignee
   * @param assignee The assignee to filter by, or null to clear the filter
   */
  async setAssigneeFilter(assignee: string | null): Promise<void> {
    this.filterByAssignee = assignee;
    this.saveFilterState();
    this.updateContextVariables();
    await this.refresh();
  }

  /**
   * Clear all filters
   */
  async clearAllFilters(): Promise<void> {
    this.filterByAuthor = null;
    this.filterByStatus = [];
    this.filterByAssignee = null;
    this.saveFilterState();
    this.updateContextVariables();
    await this.refresh();
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.statusBarItem.dispose();
  }

  /**
   * Get current filter state
   * @returns Object containing current filter values
   */
  getActiveFilters(): { author: string | null; statuses: string[]; assignee: string | null } {
    return {
      author: this.filterByAuthor,
      statuses: this.filterByStatus,
      assignee: this.filterByAssignee,
    };
  }

  /**
   * Check if any filters are active
   * @returns True if any filter is active
   */
  hasActiveFilters(): boolean {
    return this.filterByAuthor !== null || this.filterByStatus.length > 0 || this.filterByAssignee !== null;
  }

  /**
   * Update VS Code context variables for filter states
   * This enables conditional icon switching in package.json
   */
  private updateContextVariables(): void {
    commands.executeCommand('setContext', 'isFilteredByAuthor', this.filterByAuthor !== null);
    commands.executeCommand('setContext', 'isFilteredByAssignee', this.filterByAssignee !== null);
    commands.executeCommand('setContext', 'isFilteredByStatus', this.filterByStatus.length > 0);
    commands.executeCommand('setContext', 'hasActiveFilters', this.hasActiveFilters());
  }

  async refresh(entry?: CommentListEntry): Promise<void> {
    await window.withProgress(
      {
        location: ProgressLocation.Window,
        title: 'Refreshing comments...',
        cancellable: false,
      },
      async () => {
        this._onDidChangeTreeData.fire(entry);
        // Small delay to ensure the progress indicator is visible
        await new Promise((resolve) => setTimeout(resolve, 100));
        await this.updateStatusBar();
      },
    );
  }

  /**
   * Update status bar with comment count
   * Shows filtered vs total comment count when filters are active
   */
  private async updateStatusBar(): Promise<void> {
    try {
      // Get filtered comment count
      const filteredFiles = await this.exportFactory.getFilesContainingComments(
        this.filterByAuthor,
        this.filterByStatus,
        this.filterByAssignee,
      );

      let filteredCount = 0;
      for (const file of filteredFiles) {
        const comments = await this.exportFactory.getComments(
          file,
          this.filterByAuthor,
          this.filterByStatus,
          this.filterByAssignee,
        );
        filteredCount += comments.length;
      }

      // Get total comment count (no filters)
      const allFiles = await this.exportFactory.getFilesContainingComments(null, [], null);
      let totalCount = 0;
      for (const file of allFiles) {
        const comments = await this.exportFactory.getComments(file, null, [], null);
        totalCount += comments.length;
      }

      // Update status bar text based on filter state
      if (this.hasActiveFilters()) {
        this.statusBarItem.text = `$(comment) ${filteredCount}/${totalCount} comments`;
        this.statusBarItem.tooltip = `Showing ${filteredCount} of ${totalCount} comments (filtered)`;
      } else {
        this.statusBarItem.text = `$(comment) ${totalCount} comments`;
        this.statusBarItem.tooltip = `Total comments: ${totalCount}`;
      }
    } catch (error) {
      console.error('Error updating status bar:', error);
      this.statusBarItem.text = `$(comment) Comments`;
      this.statusBarItem.tooltip = 'Unable to count comments';
    }
  }

  getTreeItem(element: CommentListEntry): TreeItem {
    // Handle sync status item
    if (element.id === '__sync_status__') {
      const item = new TreeItem(element.label, element.collapsibleState);
      item.iconPath = element.iconPath;
      item.tooltip = element.tooltip;
      item.contextValue = 'sync-status';
      return item;
    }
    return element;
  }

  getChildren(element?: CommentListEntry): Thenable<CommentListEntry[]> {
    // if no element, the first item level starts
    if (!element) {
      return this.getRootChildren();
    } else {
      return this.exportFactory.getComments(element, this.filterByAuthor, this.filterByStatus, this.filterByAssignee);
    }
  }

  /**
   * Get root level children including sync status and file entries
   */
  private async getRootChildren(): Promise<CommentListEntry[]> {
    const children: CommentListEntry[] = [];

    // Add sync status item at the top
    const syncStatusItem = this.createSyncStatusItem();
    children.push(syncStatusItem);

    // Add file entries
    const fileEntries = await this.exportFactory.getFilesContainingComments(
      this.filterByAuthor,
      this.filterByStatus,
      this.filterByAssignee,
    );
    children.push(...fileEntries);

    return children;
  }

  /**
   * Create sync status tree item
   */
  private createSyncStatusItem(): CommentListEntry {
    let label: string;
    let tooltip: string;

    if (this.lastSyncTime) {
      const formattedTime = this.lastSyncTime.toLocaleString();
      label = `Last GitLab sync: ${formattedTime}`;
      tooltip = `Last synchronized with GitLab on ${formattedTime}`;
    } else {
      label = 'GitLab: Never synced';
      tooltip = 'No GitLab synchronization has been performed yet';
    }

    const syncItem = new CommentListEntry(
      '__sync_status__',
      label,
      undefined,
      tooltip,
      TreeItemCollapsibleState.None,
      { group: '', lines: [] } as any,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    );

    // Add icon
    syncItem.iconPath = new ThemeIcon('sync');

    return syncItem;
  }
}
