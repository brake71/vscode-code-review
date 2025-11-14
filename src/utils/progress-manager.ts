import * as vscode from 'vscode';

/**
 * Statistics for CodeRabbit import operation
 */
export interface CodeRabbitImportStats {
  reviewsProcessed: number;
  commentsImported: number;
  commentsSkipped: number;
  skippedNoFile: number;
  skippedNoMessage: number;
  skippedResolved: number;
  skippedDuplicate: number;
}

/**
 * Manager for progress display and logging during import operations
 */
export class ProgressManager {
  private static outputChannel: vscode.OutputChannel | undefined;

  /**
   * Get or create the output channel for logging
   */
  private static getOutputChannel(): vscode.OutputChannel {
    if (!this.outputChannel) {
      this.outputChannel = vscode.window.createOutputChannel('Code Review');
    }
    return this.outputChannel;
  }

  /**
   * Execute a task with progress indication
   * @param title Progress notification title
   * @param task Task to execute with progress reporting
   * @returns Result of the task
   */
  public static async withProgress<T>(
    title: string,
    task: (progress: vscode.Progress<{ message?: string; increment?: number }>) => Promise<T>,
  ): Promise<T> {
    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title,
        cancellable: false,
      },
      task,
    );
  }

  /**
   * Log a message to the output channel
   * @param message Message to log
   */
  public static log(message: string): void {
    const channel = this.getOutputChannel();
    const timestamp = new Date().toISOString();
    channel.appendLine(`[${timestamp}] ${message}`);
  }

  /**
   * Display import results to the user
   * @param stats Import statistics
   */
  public static showImportResults(stats: CodeRabbitImportStats): void {
    const {
      reviewsProcessed,
      commentsImported,
      commentsSkipped,
      skippedNoFile,
      skippedNoMessage,
      skippedResolved,
      skippedDuplicate,
    } = stats;

    // Log detailed statistics
    this.log('=== CodeRabbit Import Results ===');
    this.log(`Reviews processed: ${reviewsProcessed}`);
    this.log(`Comments imported: ${commentsImported}`);
    this.log(`Comments skipped: ${commentsSkipped}`);
    this.log(`  - No file: ${skippedNoFile}`);
    this.log(`  - No message: ${skippedNoMessage}`);
    this.log(`  - Resolved: ${skippedResolved}`);
    this.log(`  - Duplicate: ${skippedDuplicate}`);
    this.log('================================');

    // Show user-friendly notification
    if (commentsImported > 0) {
      const message = `Successfully imported ${commentsImported} comment(s) from ${reviewsProcessed} review(s)`;
      const details =
        commentsSkipped > 0
          ? ` (${commentsSkipped} skipped: ${skippedNoFile} no file, ${skippedNoMessage} no message, ${skippedResolved} resolved, ${skippedDuplicate} duplicate)`
          : '';

      vscode.window.showInformationMessage(message + details);
      this.log(`Import completed successfully: ${message}${details}`);
    } else if (reviewsProcessed > 0) {
      const message = `No new comments to import from ${reviewsProcessed} review(s)`;
      const details = commentsSkipped > 0 ? ` (${commentsSkipped} skipped)` : '';

      vscode.window.showWarningMessage(message + details);
      this.log(`Import completed with no new comments: ${message}${details}`);
    } else {
      const message = 'No reviews found matching the specified filters';
      vscode.window.showWarningMessage(message);
      this.log(`Import completed: ${message}`);
    }
  }

  /**
   * Show an error message and log it
   * @param message Error message
   * @param error Optional error object
   */
  public static showError(message: string, error?: Error): void {
    this.log(`ERROR: ${message}`);
    if (error) {
      this.log(`Error details: ${error.message}`);
      if (error.stack) {
        this.log(`Stack trace: ${error.stack}`);
      }
    }
    vscode.window.showErrorMessage(message);
  }

  /**
   * Dispose of resources
   */
  public static dispose(): void {
    if (this.outputChannel) {
      this.outputChannel.dispose();
      this.outputChannel = undefined;
    }
  }
}
