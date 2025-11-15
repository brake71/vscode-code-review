import {
  CancellationToken,
  CodeLens,
  CodeLensProvider,
  Range,
  TextDocument,
  Command,
  workspace,
  EventEmitter,
  Event,
} from 'vscode';
import { ExportFactory } from './export-factory';
import { ReviewFileExportSection } from './interfaces';
import { CsvEntry } from './model';
import { symbolForPriority } from './utils/editor-utils';
import { rangesFromStringDefinition } from './utils/workspace-util';

export class CommentLensProvider implements CodeLensProvider {
  private _onDidChangeCodeLenses: EventEmitter<void> = new EventEmitter<void>();
  public readonly onDidChangeCodeLenses: Event<void> = this._onDidChangeCodeLenses.event;

  constructor(private exportFactory: ExportFactory) {}

  /**
   * Refresh CodeLens display
   */
  public refresh(): void {
    this._onDidChangeCodeLenses.fire();
  }

  /**
   * Check if a comment should be displayed inline
   * @param comment The comment to check
   * @returns true if the comment should be displayed, false otherwise
   */
  private shouldDisplayInline(comment: CsvEntry): boolean {
    // Get hidden statuses from configuration
    const hiddenStatuses = (workspace.getConfiguration().get('code-review.hiddenInlineStatuses') as string[]) || [
      'Closed',
    ];

    // If comment has no status or empty status, display it
    if (!comment.status || comment.status.trim() === '') {
      return true;
    }

    // Check if comment status is in the hidden list (case-insensitive)
    const isHidden = hiddenStatuses.some((hiddenStatus) => hiddenStatus.toLowerCase() === comment.status.toLowerCase());

    return !isHidden;
  }

  public provideCodeLenses(document: TextDocument, token: CancellationToken): CodeLens[] | Thenable<CodeLens[]> {
    return this.exportFactory.getFilesContainingComments().then((filesWithComments) => {
      const codeLenses: CodeLens[] = [];
      // Normalize document path for comparison
      const normalizedDocPath = document.fileName.replace(/\\/g, '/');
      filesWithComments.forEach((el) => {
        const normalizedGroup = el.data.group.replace(/\\/g, '/');
        if (normalizedDocPath.endsWith(normalizedGroup)) {
          el.data.lines.forEach((csvEntry) => {
            // Filter out comments with hidden statuses
            if (!this.shouldDisplayInline(csvEntry)) {
              return; // Skip this comment
            }

            const fileSection: ReviewFileExportSection = {
              group: csvEntry.filename,
              lines: el.data.lines,
            };
            const csvRef: CsvEntry | undefined = csvEntry;
            const prio = Number(csvEntry.priority); // be sure the value is a number
            const priorityString = prio
              ? ` | Priority: ${csvEntry.priority}${symbolForPriority(Number(csvEntry.priority))}`
              : '';
            const command: Command = {
              title: `Code Review: ${csvEntry.title}${priorityString}`,
              tooltip: csvEntry.comment,
              command: 'codeReview.openSelection',
              arguments: [fileSection, csvRef],
            };

            rangesFromStringDefinition(csvEntry.lines).forEach((range: Range) => {
              codeLenses.push(new CodeLens(range, command));
            });
          });
        }
      });
      return codeLenses;
    });
  }
  // public resolveCodeLens?(codeLens: CodeLens, token: CancellationToken): CodeLens | Thenable<CodeLens> {
  //   return new CodeLens(new Range(new Position(0, 0), new Position(1, 2)));
  // }
}
