import * as vscode from 'vscode';
import { CsvEntry } from './model';
import { FileGenerator } from './file-generator';
import { CodeRabbitDBConnector, CodeRabbitComment, CodeRabbitImportOptions } from './utils/coderabbit-db-connector';
import { CSVMerger } from './utils/csv-merger';
import { ProgressManager, CodeRabbitImportStats } from './utils/progress-manager';
import { getCurrentCommitSha, getCommitShaForFile, getBlameAuthor, batchGetBlameInfo } from './utils/git-utils';

/**
 * Factory class for importing code review comments from CodeRabbit database
 */
export class CodeRabbitImportFactory {
  constructor(private workspaceRoot: string, private reviewFile: string, private generator: FileGenerator) {}

  /**
   * Import comments from CodeRabbit with interactive filters
   * @returns true if import was successful, false otherwise
   */
  public async importFromCodeRabbit(): Promise<boolean> {
    try {
      // Prompt user for filter options
      const options = await this.promptForFilters();
      if (!options) {
        // User cancelled
        return false;
      }

      // Execute import with the selected options
      const stats = await this.importFromCodeRabbitWithOptions(options);

      // Display results
      ProgressManager.showImportResults(stats);

      return stats.commentsImported > 0;
    } catch (error) {
      ProgressManager.showError(
        `Failed to import from CodeRabbit: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined,
      );
      return false;
    }
  }

  /**
   * Import comments from CodeRabbit with specified options
   * @param options Filter options for the import
   * @returns Import statistics
   */
  public async importFromCodeRabbitWithOptions(options: CodeRabbitImportOptions): Promise<CodeRabbitImportStats> {
    const stats: CodeRabbitImportStats = {
      reviewsProcessed: 0,
      commentsImported: 0,
      commentsSkipped: 0,
      skippedNoFile: 0,
      skippedNoMessage: 0,
      skippedResolved: 0,
      skippedDuplicate: 0,
    };

    return ProgressManager.withProgress('Importing from CodeRabbit...', async (progress) => {
      // Validate configuration
      this.validateConfiguration();

      progress.report({ message: 'Finding CodeRabbit database...' });
      ProgressManager.log('Starting CodeRabbit import');
      ProgressManager.log(`Workspace root: ${this.workspaceRoot}`);
      ProgressManager.log(`Review file: ${this.reviewFile}`);

      // Find workspace storage path
      const connector = new CodeRabbitDBConnector(this.workspaceRoot);
      const dbPath = await connector.findWorkspacePath();
      ProgressManager.log(`Found database at: ${dbPath}`);

      progress.report({ message: 'Extracting reviews...' });

      // Extract reviews with filters
      const reviews = await connector.extractReviews(dbPath, options);
      stats.reviewsProcessed = reviews.length;
      ProgressManager.log(`Found ${reviews.length} review(s) matching filters`);

      if (reviews.length === 0) {
        return stats;
      }

      progress.report({ message: 'Processing comments...' });

      // Extract comments from reviews
      const { comments, skippedResolved } = connector.extractComments(reviews);
      stats.skippedResolved = skippedResolved;
      stats.commentsSkipped += skippedResolved;
      ProgressManager.log(`Extracted ${comments.length} comment(s) from reviews`);
      ProgressManager.log(`Skipped ${skippedResolved} resolved comment(s)`);

      // Convert to CSV entries
      const csvEntries = await this.convertToCSVEntries(comments, stats);
      ProgressManager.log(`Converted ${csvEntries.length} comment(s) to CSV format`);

      progress.report({ message: 'Merging with existing comments...' });

      // Merge with existing CSV
      const merger = new CSVMerger(this.reviewFile);
      const existing = await merger.readExisting();
      ProgressManager.log(`Found ${existing.length} existing comment(s) in CSV`);

      const { merged, skippedDuplicates } = merger.mergeComments(existing, csvEntries);
      stats.skippedDuplicate = skippedDuplicates;
      stats.commentsSkipped += skippedDuplicates;
      stats.commentsImported = csvEntries.length - skippedDuplicates;
      ProgressManager.log(`Skipped ${skippedDuplicates} duplicate(s)`);

      progress.report({ message: 'Writing to file...' });

      // Write merged comments
      const success = await merger.writeComments(merged);
      if (!success) {
        throw new Error('Failed to write comments to CSV file');
      }

      ProgressManager.log(`Successfully wrote ${merged.length} comment(s) to CSV`);

      return stats;
    });
  }

  /**
   * Prompt user for filter options
   * @returns Filter options or undefined if cancelled
   */
  private async promptForFilters(): Promise<CodeRabbitImportOptions | undefined> {
    const options: CodeRabbitImportOptions = {};

    // Prompt for branch filter
    const branchInput = await vscode.window.showQuickPick(['All branches', 'Specify branch...'], {
      placeHolder: 'Select branch filter',
      ignoreFocusOut: true,
    });

    if (!branchInput) {
      return undefined; // User cancelled
    }

    if (branchInput === 'Specify branch...') {
      const branch = await vscode.window.showInputBox({
        prompt: 'Enter branch name',
        placeHolder: 'e.g., main, develop',
        ignoreFocusOut: true,
      });

      if (branch === undefined) {
        return undefined; // User cancelled
      }

      if (branch) {
        options.branch = branch;
      }
    }

    // Prompt for start date
    const startDateInput = await vscode.window.showInputBox({
      prompt: 'Enter start date (optional, ISO 8601 format)',
      placeHolder: 'e.g., 2024-01-01 or 2024-01-01T00:00:00Z',
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value) {
          return null; // Empty is valid (optional)
        }
        try {
          const date = new Date(value);
          if (isNaN(date.getTime())) {
            return 'Invalid date format. Use ISO 8601 format (e.g., 2024-01-01)';
          }
          return null;
        } catch {
          return 'Invalid date format. Use ISO 8601 format (e.g., 2024-01-01)';
        }
      },
    });

    if (startDateInput === undefined) {
      return undefined; // User cancelled
    }

    if (startDateInput) {
      options.startDate = startDateInput;
    }

    // Prompt for end date
    const endDateInput = await vscode.window.showInputBox({
      prompt: 'Enter end date (optional, ISO 8601 format)',
      placeHolder: 'e.g., 2024-12-31 or 2024-12-31T23:59:59Z',
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value) {
          return null; // Empty is valid (optional)
        }
        try {
          const date = new Date(value);
          if (isNaN(date.getTime())) {
            return 'Invalid date format. Use ISO 8601 format (e.g., 2024-12-31)';
          }
          return null;
        } catch {
          return 'Invalid date format. Use ISO 8601 format (e.g., 2024-12-31)';
        }
      },
    });

    if (endDateInput === undefined) {
      return undefined; // User cancelled
    }

    if (endDateInput) {
      options.endDate = endDateInput;
    }

    // Prompt for "latest only" option
    const latestOnlyInput = await vscode.window.showQuickPick(
      [
        { label: 'Import all matching reviews', value: false },
        { label: 'Import only the latest review', value: true },
      ],
      {
        placeHolder: 'Select review import mode',
        ignoreFocusOut: true,
      },
    );

    if (!latestOnlyInput) {
      return undefined; // User cancelled
    }

    options.latestOnly = latestOnlyInput.value;

    ProgressManager.log(`Filter options: ${JSON.stringify(options)}`);

    return options;
  }

  /**
   * Convert CodeRabbit comments to CSV entries
   * Uses batch processing for Git operations to improve performance
   * @param comments Array of CodeRabbit comments
   * @param stats Statistics object to update
   * @returns Array of CSV entries
   */
  private async convertToCSVEntries(comments: CodeRabbitComment[], stats: CodeRabbitImportStats): Promise<CsvEntry[]> {
    const csvEntries: CsvEntry[] = [];
    const currentSha = getCurrentCommitSha(this.workspaceRoot);

    // Group comments by file for batch processing
    const commentsByFile = new Map<string, CodeRabbitComment[]>();
    for (const comment of comments) {
      if (!comment.filename) {
        stats.skippedNoFile++;
        stats.commentsSkipped++;
        ProgressManager.log(`Skipped comment ${comment.id}: no filename`);
        continue;
      }

      if (!comment.comment || comment.comment.trim().length === 0) {
        stats.skippedNoMessage++;
        stats.commentsSkipped++;
        ProgressManager.log(`Skipped comment ${comment.id}: no message`);
        continue;
      }

      if (!commentsByFile.has(comment.filename)) {
        commentsByFile.set(comment.filename, []);
      }
      commentsByFile.get(comment.filename)!.push(comment);
    }

    // Process each file's comments in batch
    for (const [filename, fileComments] of commentsByFile) {
      try {
        // Batch get blame info for all lines in this file
        const lines = fileComments.map((c) => c.startLine);
        const blameInfo = batchGetBlameInfo(this.workspaceRoot, filename, lines);

        // Process each comment with the cached blame info
        for (const comment of fileComments) {
          try {
            const info = blameInfo.get(comment.startLine);
            const sha = info?.sha || currentSha;
            const assignee = info?.author || '';

            // Build URL
            const url = this.buildUrl(sha, comment.filename, comment.startLine, comment.endLine);

            // Format comment text
            const commentText = this.formatCommentText(comment);

            // Extract title (first line of comment)
            const title = commentText.split('\n')[0].substring(0, 100); // Limit to 100 chars

            // Map severity to priority
            const priority = this.mapSeverityToPriority(comment.severity);

            // Extract category
            const category = this.extractCategory(comment.indicatorTypes);

            // Format lines
            const lines = `${comment.startLine}:0-${comment.endLine}:0`;

            // Create CSV entry
            const csvEntry: CsvEntry = {
              id: comment.id,
              sha,
              filename: comment.filename,
              url,
              lines,
              title,
              comment: commentText,
              priority,
              category,
              additional: '',
              private: 0,
              assignee,
              issue_id: '',
              status: 'Open',
              author: '',
            };

            csvEntries.push(csvEntry);
          } catch (error) {
            stats.commentsSkipped++;
            ProgressManager.log(
              `Error processing comment ${comment.id}: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }
      } catch (error) {
        // If batch processing fails for a file, fall back to individual processing
        ProgressManager.log(
          `Batch processing failed for ${filename}, falling back to individual processing: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );

        for (const comment of fileComments) {
          try {
            // Get Git SHA for the file
            let sha: string;
            try {
              sha = getCommitShaForFile(this.workspaceRoot, comment.filename, comment.startLine);
              if (!sha) {
                sha = currentSha;
              }
            } catch (error) {
              sha = currentSha;
              ProgressManager.log(`Failed to get SHA for ${comment.filename}:${comment.startLine}, using current SHA`);
            }

            // Get author through git blame
            let assignee = '';
            try {
              assignee = getBlameAuthor(this.workspaceRoot, comment.filename, comment.startLine);
            } catch (error) {
              ProgressManager.log(`Failed to get author for ${comment.filename}:${comment.startLine}`);
            }

            // Build URL
            const url = this.buildUrl(sha, comment.filename, comment.startLine, comment.endLine);

            // Format comment text
            const commentText = this.formatCommentText(comment);

            // Extract title (first line of comment)
            const title = commentText.split('\n')[0].substring(0, 100); // Limit to 100 chars

            // Map severity to priority
            const priority = this.mapSeverityToPriority(comment.severity);

            // Extract category
            const category = this.extractCategory(comment.indicatorTypes);

            // Format lines
            const lines = `${comment.startLine}:0-${comment.endLine}:0`;

            // Create CSV entry
            const csvEntry: CsvEntry = {
              id: comment.id,
              sha,
              filename: comment.filename,
              url,
              lines,
              title,
              comment: commentText,
              priority,
              category,
              additional: '',
              private: 0,
              assignee,
              issue_id: '',
              status: 'Open',
              author: '',
            };

            csvEntries.push(csvEntry);
          } catch (error) {
            stats.commentsSkipped++;
            ProgressManager.log(
              `Error processing comment ${comment.id}: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }
      }
    }

    return csvEntries;
  }

  /**
   * Format comment text by combining comment, suggestions, and analysis
   * @param comment CodeRabbit comment
   * @returns Formatted comment text
   */
  private formatCommentText(comment: CodeRabbitComment): string {
    let text = comment.comment;

    // Add suggestions
    if (comment.suggestions && comment.suggestions.length > 0) {
      text += '\n\nПредложения:\n';
      comment.suggestions.forEach((suggestion) => {
        text += `\t${suggestion}\n`;
      });
    }

    // Add analysis
    if (comment.analysis?.chain && comment.analysis.chain.length > 0) {
      text += '\n\nАнализ:\n';
      comment.analysis.chain.forEach((analysis) => {
        text += `${analysis}\n`;
      });
    }

    return text;
  }

  /**
   * Map CodeRabbit severity to priority number
   * @param severity CodeRabbit severity level
   * @returns Priority number (1-3)
   */
  private mapSeverityToPriority(severity?: string): number {
    if (!severity) {
      return 1;
    }

    switch (severity.toLowerCase()) {
      case 'critical':
        return 3;
      case 'major':
        return 2;
      case 'minor':
      case 'trivial':
        return 1;
      default:
        return 1;
    }
  }

  /**
   * Extract category from indicator types
   * Converts snake_case to Title Case (e.g., potential_issue -> Potential Issue)
   * @param indicatorTypes Array of indicator types
   * @returns Category string
   */
  private extractCategory(indicatorTypes?: string[]): string {
    if (!indicatorTypes || indicatorTypes.length === 0) {
      return 'Unknown';
    }

    const firstType = indicatorTypes[0];
    if (!firstType) {
      return 'Unknown';
    }

    // Convert snake_case to Title Case
    // potential_issue -> Potential Issue
    // nitpick -> Nitpick
    // refactor_suggestion -> Refactor Suggestion
    const parts = firstType.split('_');
    const category = parts.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');

    return category;
  }

  /**
   * Build URL for the comment using configured URL template
   * @param sha Commit SHA
   * @param filename File path
   * @param startLine Start line number
   * @param endLine End line number
   * @returns Formatted URL
   */
  private buildUrl(sha: string, filename: string, startLine: number, endLine: number): string {
    const config = vscode.workspace.getConfiguration();
    const customUrl = config.get('code-review.customUrl') as string;
    const baseUrl = config.get('code-review.baseUrl') as string;

    if (customUrl) {
      // Use customUrl with placeholders
      return customUrl
        .replace('{sha}', sha)
        .replace('{file}', filename)
        .replace('{start}', startLine.toString())
        .replace('{end}', endLine.toString());
    } else if (baseUrl) {
      // Use baseUrl (existing extension logic)
      return `${baseUrl}${sha}/${filename}#L${startLine}-L${endLine}`;
    } else {
      // If nothing is configured, return empty string
      return '';
    }
  }

  /**
   * Validate that required configuration is present
   * @throws Error if configuration is invalid
   */
  private validateConfiguration(): void {
    const config = vscode.workspace.getConfiguration();
    const customUrl = config.get('code-review.customUrl') as string;
    const baseUrl = config.get('code-review.baseUrl') as string;

    // Check if at least one URL is configured
    if (!customUrl && !baseUrl) {
      throw new Error(
        'Missing URL configuration. Please set either "code-review.customUrl" or "code-review.baseUrl" in VS Code settings. ' +
          'This is required to generate links to code in your repository.',
      );
    }

    // Validate URL format for the configured URL
    const urlToValidate = customUrl || baseUrl;
    if (urlToValidate) {
      const trimmedUrl = urlToValidate.trim();

      if (trimmedUrl.length === 0) {
        throw new Error(
          'URL configuration is empty. Please provide a valid URL in "code-review.customUrl" or "code-review.baseUrl" settings.',
        );
      }

      if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
        throw new Error(
          `Invalid URL format: "${trimmedUrl}". URL must start with http:// or https://. ` +
            'Please update your "code-review.customUrl" or "code-review.baseUrl" setting.',
        );
      }
    }
  }
}
