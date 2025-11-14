import {
  commands,
  workspace,
  window,
  ExtensionContext,
  Uri,
  Range,
  ViewColumn,
  QuickPickItem,
  Disposable,
  FileSystemWatcher,
  TextEditor,
  DocumentFilter,
  languages,
} from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { CheckFlag, FileGenerator } from './file-generator';
import { ReviewCommentService } from './review-comment';
import { rangesFromStringDefinition } from './utils/workspace-util';
import { WebViewComponent } from './webview';
import { ExportFactory } from './export-factory';
import { CommentsProvider, CommentView } from './comment-view';
import { ReviewFileExportSection } from './interfaces';
import { CsvEntry } from './model';
import { CommentListEntry } from './comment-list-entry';
import { ImportFactory, ConflictMode } from './import-factory';
import { CodeRabbitImportFactory } from './coderabbit-import-factory';
import { Decorations } from './utils/decoration-utils';
import { CommentLensProvider } from './comment-lens-provider';

const checkForCodeReviewFile = (fileName: string) => {
  commands.executeCommand('setContext', 'codeReview:displayCodeReviewExplorer', fs.existsSync(fileName));
};

export class WorkspaceContext {
  private defaultTemplate!: Uri;
  private defaultMarkdownTemplate!: Uri;
  private generator!: FileGenerator;
  private exportFactory!: ExportFactory;
  private importFactory!: ImportFactory;
  private commentService!: ReviewCommentService;
  private webview: WebViewComponent;
  private commentsProvider!: CommentsProvider;
  private commentLensProvider!: CommentLensProvider;
  private fileWatcher!: FileSystemWatcher;

  private openSelectionRegistration!: Disposable;
  private addNoteRegistration!: Disposable;
  private filterByCommitEnableRegistration!: Disposable;
  private filterByCommitDisableRegistration!: Disposable;
  private filterByFilenameEnableRegistration!: Disposable;
  private filterByFilenameDisableRegistration!: Disposable;
  private filterByPriorityEnableRegistration!: Disposable;
  private filterByPriorityDisableRegistration!: Disposable;
  private filterByAuthorRegistration!: Disposable;
  private filterByStatusRegistration!: Disposable;
  private filterByAssigneeRegistration!: Disposable;
  private clearAuthorFilterRegistration!: Disposable;
  private clearAssigneeFilterRegistration!: Disposable;
  private clearStatusFilterRegistration!: Disposable;
  private clearAllFiltersRegistration!: Disposable;
  private setReviewFileSelectedCsvRegistration!: Disposable;
  private deleteNoteRegistration!: Disposable;
  private exportAsHtmlWithDefaultTemplateRegistration!: Disposable;
  private exportAsHtmlWithHandlebarsTemplateRegistration!: Disposable;
  private exportAsMarkdownWithDefaultTemplateRegistration!: Disposable;
  private exportAsMarkdownWithHandlebarsTemplateRegistration!: Disposable;
  private exportAsGitLabImportableCsvRegistration!: Disposable;
  private exportAsGitHubImportableCsvRegistration!: Disposable;
  private exportAsJiraImportableCsvRegistration!: Disposable;
  private exportAsJsonRegistration!: Disposable;
  private importFromJsonRegistration!: Disposable;
  private importFromCodeRabbitRegistration!: Disposable;
  private commentCodeLensProviderregistration!: Disposable;
  private decorations: Decorations;

  constructor(private context: ExtensionContext, public workspaceRoot: string) {
    // create a new file if not already exist
    this.webview = new WebViewComponent(context);
    this.decorations = new Decorations(context);
    this.setup();
  }

  setup() {
    this.updateGenerator();
    this.updateExportFactory();
    this.updateImportFactory();
    this.updateReviewCommentService();
    this.updateCommentsProvider();
    this.setupFileWatcher();
    this.watchConfiguration();
    this.watchGitSwitch();
    this.watchActiveEditor();
    this.watchForFileChanges();
    new CommentView(this.commentsProvider);
    this.updateDecorations();
  }

  watchConfiguration() {
    workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('code-review.filename')) {
        this.refreshCommands();
      }
      if (event.affectsConfiguration('code-review.hiddenInlineStatuses')) {
        this.commentLensProvider?.refresh();
      }
    });
  }

  watchActiveEditor() {
    // Refresh comment view on file focus
    window.onDidChangeActiveTextEditor(async (_) => {
      if (this.exportFactory.refreshFilterByFilename()) {
        await this.commentsProvider.refresh();
      }
      this.updateDecorations();
    });
  }

  clearVisibleDecorations() {
    window.visibleTextEditors.forEach((editor: TextEditor) => {
      this.decorations.clear(editor);
    });
  }

  highlightCommentsInActiveEditor(editor: TextEditor) {
    this.decorations.clear(editor);

    this.exportFactory.getFilesContainingComments().then((fileEntries) => {
      const matchingFile = fileEntries.find((file) => editor.document.fileName.endsWith(file.label));
      if (matchingFile) {
        // iterate over all comments associated with this file
        this.exportFactory.getComments(matchingFile).then((comments) => {
          // Filter out comments with hidden statuses
          const hiddenStatuses = (workspace.getConfiguration().get('code-review.hiddenInlineStatuses') as string[]) || [
            'Closed',
          ];
          const visibleComments = comments[0].data.lines.filter((comment: CsvEntry) => {
            // If comment has no status or empty status, display it
            if (!comment.status || comment.status.trim() === '') {
              return true;
            }
            // Check if comment status is in the hidden list (case-insensitive)
            const isHidden = hiddenStatuses.some(
              (hiddenStatus) => hiddenStatus.toLowerCase() === comment.status.toLowerCase(),
            );
            return !isHidden;
          });

          // comments[0] as we only need a single comment related to a line to identify the place where to put it
          this.decorations.underlineDecoration(visibleComments, editor);
          this.decorations.commentIconDecoration(visibleComments, editor);
        });
      }
    });
  }

  /**
   * Refresh comment view on git switch
   */
  watchGitSwitch() {
    const gitDirectory = (workspace.getConfiguration().get('code-review.gitDirectory') as string) ?? '.';
    const gitHeadPath = path.resolve(gitDirectory, '.git/HEAD');
    const gitWatcher = workspace.createFileSystemWatcher(`**${gitHeadPath}`);
    gitWatcher.onDidChange(async () => {
      this.exportFactory.refreshFilterByCommit();
      await this.commentsProvider.refresh();
      this.updateDecorations();
    });
  }

  /**
   * setup review file watcher
   */
  setupFileWatcher() {
    this.fileWatcher = workspace.createFileSystemWatcher(`**/${this.generator.reviewFilePath}`);
  }

  /**
   * watch on the review file for changes
   */
  watchForFileChanges() {
    // refresh comment view on manual changes in the review file
    checkForCodeReviewFile(this.generator.absoluteReviewFilePath);
    this.fileWatcher.onDidChange(async () => {
      this.exportFactory.invalidateCache();
      await this.commentsProvider.refresh();
    });
    this.fileWatcher.onDidCreate(async () => {
      this.exportFactory.invalidateCache();
      await this.commentsProvider.refresh();
      checkForCodeReviewFile(this.generator.absoluteReviewFilePath);
    });
    this.fileWatcher.onDidDelete(async () => {
      this.exportFactory.invalidateCache();
      await this.commentsProvider.refresh();
      checkForCodeReviewFile(this.generator.absoluteReviewFilePath);
    });
  }

  /**
   * refresh highlighted comments in text editor
   */
  updateDecorations() {
    if (window.activeTextEditor) {
      this.highlightCommentsInActiveEditor(window.activeTextEditor);
    }
  }

  updateGenerator() {
    this.generator = new FileGenerator(this.workspaceRoot);
    this.generator.check(CheckFlag.format | CheckFlag.migrate);
  }

  updateExportFactory() {
    this.exportFactory = new ExportFactory(this.context, this.workspaceRoot, this.generator);
  }
  updateImportFactory() {
    this.importFactory = new ImportFactory(this.workspaceRoot, this.exportFactory.absoluteFilePath, this.generator);
  }

  updateReviewCommentService() {
    this.commentService = new ReviewCommentService(this.generator.absoluteReviewFilePath, this.workspaceRoot);
  }

  updateCommentsProvider() {
    /**
     * register comment view
     */
    // Dispose old provider if it exists
    if (this.commentsProvider) {
      this.commentsProvider.dispose();
    }
    this.commentsProvider = new CommentsProvider(this.context, this.exportFactory);
  }

  getDefaultTemplate(): Uri {
    const defaultConfigurationTemplatePath = workspace
      .getConfiguration()
      .get('code-review.defaultTemplatePath') as string;
    return defaultConfigurationTemplatePath
      ? Uri.file(defaultConfigurationTemplatePath)
      : Uri.parse(this.context.asAbsolutePath(path.join('dist', 'template.default.hbs')));
  }

  getDefaultMarkdownTemplate(): Uri {
    const defaultMarkdownTemplatePath = workspace
      .getConfiguration()
      .get('code-review.defaultMarkdownTemplatePath') as string;
    return defaultMarkdownTemplatePath
      ? Uri.file(defaultMarkdownTemplatePath)
      : Uri.parse(this.context.asAbsolutePath(path.join('dist', 'template-markdown.default.hbs')));
  }

  registerCommands() {
    this.openSelectionRegistration = commands.registerCommand(
      'codeReview.openSelection',
      (fileSection: ReviewFileExportSection, csvRef?: CsvEntry) => {
        if (!this.generator.check()) {
          return;
        }

        const filePath = path.join(this.workspaceRoot, fileSection.group);
        workspace.openTextDocument(filePath).then(
          (doc) => {
            window.showTextDocument(doc, ViewColumn.One).then((textEditor) => {
              if (csvRef) {
                const ranges: Range[] = rangesFromStringDefinition(csvRef.lines);
                textEditor.revealRange(ranges[0]);
                this.webview.editComment(this.commentService, ranges, csvRef, async () => {
                  await this.commentsProvider.refresh();
                  this.updateDecorations();
                });
              }
            });
          },
          (err) => {
            const msg = `Cannot not open file: '${filePath}': File does not exist.`;
            window.showErrorMessage(msg);
          },
        );
      },
    );

    /**
     * register comment panel web view
     */
    this.addNoteRegistration = commands.registerCommand('codeReview.addNote', async () => {
      if (!window.activeTextEditor?.selection) {
        window.showErrorMessage(
          `No selection made. Please select something you want to add a comment to and try again.`,
        );
        return;
      }
      // Execute every time a comment will be added to check file format
      if (!this.generator.create()) {
        return;
      }

      this.webview.addComment(this.commentService, async () => {
        await this.commentsProvider.refresh();
        this.updateDecorations();
      });
    });

    this.filterByCommitEnableRegistration = commands.registerCommand('codeReview.filterByCommitEnable', async () => {
      await this.setFilterByCommit(true);
    });

    this.filterByCommitDisableRegistration = commands.registerCommand('codeReview.filterByCommitDisable', async () => {
      await this.setFilterByCommit(false);
    });

    this.filterByFilenameEnableRegistration = commands.registerCommand(
      'codeReview.filterByFilenameEnable',
      async () => {
        await this.setFilterByFilename(true);
      },
    );

    this.filterByFilenameDisableRegistration = commands.registerCommand(
      'codeReview.filterByFilenameDisable',
      async () => {
        await this.setFilterByFilename(false);
      },
    );

    this.filterByPriorityEnableRegistration = commands.registerCommand(
      'codeReview.filterByPriorityEnable',
      async () => {
        await this.setFilterByPriority(true);
      },
    );

    this.filterByPriorityDisableRegistration = commands.registerCommand(
      'codeReview.filterByPriorityDisable',
      async () => {
        await this.setFilterByPriority(false);
      },
    );

    /**
     * Filter comments by author
     */
    this.filterByAuthorRegistration = commands.registerCommand('codeReview.filterByAuthor', async () => {
      const authors = await this.exportFactory.getUniqueAuthors();

      if (authors.length === 0) {
        window.showInformationMessage('No authors found in comments');
        return;
      }

      const selected = await window.showQuickPick(['(Clear filter)', ...authors], {
        placeHolder: 'Select author to filter by',
      });

      if (selected === '(Clear filter)') {
        await this.commentsProvider.setAuthorFilter(null);
      } else if (selected) {
        await this.commentsProvider.setAuthorFilter(selected);
      }
    });

    /**
     * Filter comments by status
     */
    this.filterByStatusRegistration = commands.registerCommand('codeReview.filterByStatus', async () => {
      const statusOptions = (workspace.getConfiguration().get('code-review.statusOptions') as string[]) || [
        'Open',
        'In Progress',
        'Resolved',
        'Closed',
      ];

      class StatusPickItem implements QuickPickItem {
        constructor(public label: string, public value: string | null, public description?: string | undefined) {}
      }

      const items: StatusPickItem[] = [
        new StatusPickItem('(Clear filter)', null, 'Clear status filter'),
        ...statusOptions.map((s: string) => new StatusPickItem(s, s)),
      ];

      const selected = await window.showQuickPick(items, {
        placeHolder: 'Select status(es) to filter by',
        canPickMany: true,
      });

      if (selected && selected.length > 0) {
        // Check if clear filter was selected
        if (selected.some((s: StatusPickItem) => s.value === null)) {
          await this.commentsProvider.setStatusFilter([]);
        } else {
          const statuses = selected
            .map((s: StatusPickItem) => s.value)
            .filter((v: string | null) => v !== null) as string[];
          await this.commentsProvider.setStatusFilter(statuses);
        }
      }
    });

    /**
     * Filter comments by assignee
     */
    this.filterByAssigneeRegistration = commands.registerCommand('codeReview.filterByAssignee', async () => {
      const assignees = await this.exportFactory.getUniqueAssignees();

      if (assignees.length === 0) {
        window.showInformationMessage('No assignees found in comments');
        return;
      }

      const selected = await window.showQuickPick(['(Clear filter)', '(Unassigned)', ...assignees], {
        placeHolder: 'Select assignee to filter by',
      });

      if (selected === '(Clear filter)') {
        await this.commentsProvider.setAssigneeFilter(null);
      } else if (selected === '(Unassigned)') {
        await this.commentsProvider.setAssigneeFilter('');
      } else if (selected) {
        await this.commentsProvider.setAssigneeFilter(selected);
      }
    });

    /**
     * Clear author filter
     */
    this.clearAuthorFilterRegistration = commands.registerCommand('codeReview.clearAuthorFilter', async () => {
      await this.commentsProvider.setAuthorFilter(null);
    });

    /**
     * Clear assignee filter
     */
    this.clearAssigneeFilterRegistration = commands.registerCommand('codeReview.clearAssigneeFilter', async () => {
      await this.commentsProvider.setAssigneeFilter(null);
    });

    /**
     * Clear status filter
     */
    this.clearStatusFilterRegistration = commands.registerCommand('codeReview.clearStatusFilter', async () => {
      await this.commentsProvider.setStatusFilter([]);
    });

    /**
     * Clear all filters
     */
    this.clearAllFiltersRegistration = commands.registerCommand('codeReview.clearAllFilters', async () => {
      await this.commentsProvider.clearAllFilters();
    });

    this.setReviewFileSelectedCsvRegistration = commands.registerCommand('codeReview.setReviewFileSelectedCsv', () => {
      if (!window.activeTextEditor) {
        window.showErrorMessage(`No CSV selected. Open a code-review CSV and re-run the command.`);
        return;
      }

      const file = window.activeTextEditor.document.uri;
      workspace.getConfiguration().update('code-review.filename', file.fsPath, null, undefined);

      window.showInformationMessage(`Set code-review file to: ${file.fsPath}`);
    });

    /**
     * delete an existing comment
     */
    this.deleteNoteRegistration = commands.registerCommand('codeReview.deleteNote', async (entry: CommentListEntry) => {
      if (!this.generator.check()) {
        return;
      }
      this.webview.deleteComment(this.commentService, entry);
      await this.commentsProvider.refresh();
      this.updateDecorations();
    });

    /**
     * allow users to export the report as HTML using the default output
     */
    this.exportAsHtmlWithDefaultTemplateRegistration = commands.registerCommand(
      'codeReview.exportAsHtmlWithDefaultTemplate',
      () => {
        this.exportFactory.exportForFormat('html', this.getDefaultTemplate());
      },
    );

    /**
     * allow users to export the report as HTML using a specific handlebars template
     */
    this.exportAsHtmlWithHandlebarsTemplateRegistration = commands.registerCommand(
      'codeReview.exportAsHtmlWithHandlebarsTemplate',
      () => {
        window
          .showOpenDialog({
            canSelectFolders: false,
            canSelectFiles: true,
            canSelectMany: false,
            openLabel: 'Use template',
            filters: {
              // eslint-disable-next-line @typescript-eslint/naming-convention
              Template: ['hbs', 'html', 'htm', 'handlebars'],
            },
          })
          .then((files) => {
            const template = files?.length ? files[0] : undefined;
            this.exportFactory.exportForFormat('html', template ?? this.getDefaultTemplate());
          });
      },
    );

    /**
     * allow users to export the report as Markdown using the default output
     */
    this.exportAsMarkdownWithDefaultTemplateRegistration = commands.registerCommand(
      'codeReview.exportAsMarkdownWithDefaultTemplate',
      () => {
        this.exportFactory.exportForFormat('markdown', this.getDefaultMarkdownTemplate());
      },
    );

    /**
     * allow users to export the report as HTML using a specific handlebars template
     */
    this.exportAsMarkdownWithHandlebarsTemplateRegistration = commands.registerCommand(
      'codeReview.exportAsMarkdownWithHandlebarsTemplate',
      () => {
        window
          .showOpenDialog({
            canSelectFolders: false,
            canSelectFiles: true,
            canSelectMany: false,
            openLabel: 'Use template',
            filters: {
              // eslint-disable-next-line @typescript-eslint/naming-convention
              Template: ['hbs', 'md', 'markdown', 'mdx', 'handlebars'],
            },
          })
          .then((files) => {
            const template = files?.length ? files[0] : undefined;
            this.exportFactory.exportForFormat('markdown', template ?? this.defaultTemplate);
          });
      },
    );

    /**
     * allow users to export the report as GitLab importable CSV file
     */
    this.exportAsGitLabImportableCsvRegistration = commands.registerCommand(
      'codeReview.exportAsGitLabImportableCsv',
      () => {
        this.exportFactory.exportForFormat('gitlab');
      },
    );

    /**
     * allow users to export the report as GitHub importable CSV file
     * @see https://github.com/gavinr/github-csv-tools
     */
    this.exportAsGitHubImportableCsvRegistration = commands.registerCommand(
      'codeReview.exportAsGitHubImportableCsv',
      () => {
        this.exportFactory.exportForFormat('github');
      },
    );

    /**
     * allow users to export the report as JIRA importable CSV file
     */
    this.exportAsJiraImportableCsvRegistration = commands.registerCommand(
      'codeReview.exportAsJiraImportableCsv',
      () => {
        this.exportFactory.exportForFormat('jira');
      },
    );

    /**
     * allow users to export the report as JSON file
     */
    this.exportAsJsonRegistration = commands.registerCommand('codeReview.exportAsJson', () => {
      this.exportFactory.exportForFormat('json');
    });

    /**
     * allow users to import comments from a JSON file
     */
    this.importFromJsonRegistration = commands.registerCommand('codeReview.importFromJson', () => {
      // File selection
      window
        .showOpenDialog({
          canSelectFolders: false,
          canSelectFiles: true,
          canSelectMany: false,
          openLabel: 'Select comments file to import',
          filters: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            Template: ['json'],
          },
        })
        .then((files) => {
          const filename = files?.length ? files[0] : undefined;
          if (filename) {
            const mode = workspace.getConfiguration().get('code-review.importConflictMode') as string;
            if (mode !== '') {
              this.importFactory.importCommentsFromFile(filename!.fsPath, mode as ConflictMode).then(async (result) => {
                if (result) {
                  await this.commentsProvider.refresh();
                }
              });
            } else {
              // Select the import conflict mode
              class PickItem implements QuickPickItem {
                constructor(
                  public mode: ConflictMode,
                  public label: string,
                  public description?: string | undefined,
                  public detail?: string | undefined,
                  public picked?: boolean | undefined,
                  public alwaysShow?: boolean | undefined,
                ) {}
              }

              window
                .showQuickPick<PickItem>(
                  [
                    {
                      label: 'Skip',
                      description:
                        'In case of conflict, the existing comment will be kept and the imported one will be ignored.',
                      alwaysShow: true,
                      mode: ConflictMode.skipImported,
                    } as PickItem,
                    {
                      label: 'Overwrite',
                      description: 'In case of conflict, the existing comment will be replaced with the imported one.',
                      alwaysShow: true,
                      mode: ConflictMode.replaceWithImported,
                    } as PickItem,
                    {
                      label: 'Clone',
                      description: 'In case of conflict, both the existing and the imported comments will be kept.',
                      alwaysShow: true,
                      mode: ConflictMode.importCopy,
                    } as PickItem,
                  ],
                  {
                    canPickMany: false,
                    placeHolder: 'Select the import conflict mode',
                  },
                )
                .then((item) => {
                  if (item) {
                    this.importFactory.importCommentsFromFile(filename!.fsPath, item.mode).then(async (result) => {
                      if (result) {
                        await this.commentsProvider.refresh();
                      }
                    });
                  }
                });
            }
          }
        });
    });

    /**
     * allow users to import comments from CodeRabbit database
     */
    this.importFromCodeRabbitRegistration = commands.registerCommand('codeReview.importFromCodeRabbit', async () => {
      const codeRabbitImportFactory = new CodeRabbitImportFactory(
        this.workspaceRoot,
        this.exportFactory.absoluteFilePath,
        this.generator,
      );
      const result = await codeRabbitImportFactory.importFromCodeRabbit();
      if (result) {
        await this.commentsProvider.refresh();
        this.updateDecorations();
      }
    });

    /**
     * support code lens for comment annotations in files
     */
    const ALL_FILES: DocumentFilter = { language: '*', scheme: 'file' };
    this.commentLensProvider = new CommentLensProvider(this.exportFactory);
    this.commentCodeLensProviderregistration = languages.registerCodeLensProvider(ALL_FILES, this.commentLensProvider);

    this.updateSubscriptions();
  }

  /**
   * push all registration into subscriptions
   */
  updateSubscriptions() {
    this.context.subscriptions.push(
      this.openSelectionRegistration,
      this.addNoteRegistration,
      this.deleteNoteRegistration,
      this.filterByCommitEnableRegistration,
      this.filterByCommitDisableRegistration,
      this.filterByFilenameEnableRegistration,
      this.filterByFilenameDisableRegistration,
      this.filterByPriorityEnableRegistration,
      this.filterByPriorityDisableRegistration,
      this.filterByAuthorRegistration,
      this.filterByStatusRegistration,
      this.filterByAssigneeRegistration,
      this.clearAuthorFilterRegistration,
      this.clearAssigneeFilterRegistration,
      this.clearStatusFilterRegistration,
      this.clearAllFiltersRegistration,
      this.setReviewFileSelectedCsvRegistration,
      this.exportAsHtmlWithDefaultTemplateRegistration,
      this.exportAsHtmlWithHandlebarsTemplateRegistration,
      this.exportAsMarkdownWithDefaultTemplateRegistration,
      this.exportAsMarkdownWithHandlebarsTemplateRegistration,
      this.exportAsGitLabImportableCsvRegistration,
      this.exportAsGitHubImportableCsvRegistration,
      this.exportAsJiraImportableCsvRegistration,
      this.exportAsJsonRegistration,
      this.importFromJsonRegistration,
      this.importFromCodeRabbitRegistration,
      this.commentCodeLensProviderregistration,
    );
  }

  /**
   * dispose all current registrations and update the subscriptions
   */
  unregisterCommands() {
    this.openSelectionRegistration.dispose();
    this.addNoteRegistration.dispose();
    this.deleteNoteRegistration.dispose();
    this.filterByCommitEnableRegistration.dispose();
    this.filterByCommitDisableRegistration.dispose();
    this.filterByFilenameEnableRegistration.dispose();
    this.filterByFilenameDisableRegistration.dispose();
    this.filterByPriorityEnableRegistration.dispose();
    this.filterByPriorityDisableRegistration.dispose();
    this.filterByAuthorRegistration.dispose();
    this.filterByStatusRegistration.dispose();
    this.filterByAssigneeRegistration.dispose();
    this.clearAuthorFilterRegistration.dispose();
    this.clearAssigneeFilterRegistration.dispose();
    this.clearStatusFilterRegistration.dispose();
    this.clearAllFiltersRegistration.dispose();
    this.setReviewFileSelectedCsvRegistration.dispose();
    this.exportAsHtmlWithDefaultTemplateRegistration.dispose();
    this.exportAsHtmlWithHandlebarsTemplateRegistration.dispose();
    this.exportAsMarkdownWithDefaultTemplateRegistration.dispose();
    this.exportAsMarkdownWithHandlebarsTemplateRegistration.dispose();
    this.exportAsGitLabImportableCsvRegistration.dispose();
    this.exportAsGitHubImportableCsvRegistration.dispose();
    this.exportAsJiraImportableCsvRegistration.dispose();
    this.exportAsJsonRegistration.dispose();
    this.importFromJsonRegistration.dispose();
    this.importFromCodeRabbitRegistration.dispose();
    this.commentCodeLensProviderregistration.dispose();
    this.updateSubscriptions();
  }

  refreshCommands() {
    this.clearVisibleDecorations();
    this.unregisterCommands();
    this.setup();
    this.registerCommands();
  }

  private async setFilterByFilename(state: boolean) {
    this.exportFactory.setFilterByFilename(state);
    await this.commentsProvider.refresh();
  }

  private async setFilterByCommit(state: boolean) {
    this.exportFactory.setFilterByCommit(state);
    await this.commentsProvider.refresh();
  }

  private async setFilterByPriority(state: boolean) {
    this.exportFactory.setFilterByPriority(state);
    await this.commentsProvider.refresh();
  }
}
