// @ts-nocheck
import { TreeItem, TreeItemCollapsibleState } from 'vscode';

import { ReviewFileExportSection } from './interfaces';

export class CommentListEntry extends TreeItem {
  constructor(
    public readonly id: string,
    public readonly label: string,
    public readonly text?: string,
    public readonly hoverLabel?: string,
    public readonly collapsibleState: TreeItemCollapsibleState,
    public readonly data: ReviewFileExportSection,
    public readonly prio?: number,
    public readonly priv?: number,
    public readonly assignee?: string,
    public readonly issue_id?: string,
    public readonly status?: string,
    public readonly author?: string,
  ) {
    super(label, collapsibleState);
  }

  get tooltip(): string {
    let tooltipText = this.hoverLabel ? `${this.label}\n\n${this.hoverLabel}` : this.label;

    // Add new fields to tooltip
    const additionalInfo: string[] = [];

    if (this.status) {
      additionalInfo.push(`Status: ${this.status}`);
    }
    if (this.assignee) {
      additionalInfo.push(`Assignee: ${this.assignee}`);
    }
    if (this.issue_id) {
      additionalInfo.push(`Issue ID: ${this.issue_id}`);
    }
    if (this.author) {
      additionalInfo.push(`Author: ${this.author}`);
    }

    if (additionalInfo.length > 0) {
      tooltipText += '\n\n' + additionalInfo.join('\n');
    }

    return tooltipText;
  }

  get description(): string {
    let desc = this.text ? this.text.replace(/[\r\n\x0B\x0C\u0085\u2028\u2029]+/g, ' ') : '';

    // Add status and assignee to description for quick visibility
    const statusInfo: string[] = [];

    if (this.status) {
      statusInfo.push(`[${this.status}]`);
    }
    if (this.assignee) {
      statusInfo.push(`@${this.assignee}`);
    }

    if (statusInfo.length > 0) {
      desc = statusInfo.join(' ') + (desc ? ' ' + desc : '');
    }

    return desc;
  }
}
