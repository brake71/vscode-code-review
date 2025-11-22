import { ExtensionContext, window } from 'vscode';
import { GitLabClient, GitLabIssue } from './utils/gitlab-client';
import { GitLabConfigManager } from './utils/gitlab-config';
import { TemplateEngine } from './utils/gitlab-template';
import { ReviewCommentService } from './review-comment';
import { CsvEntry } from './model';
import { getCsvFileLinesAsArray, setCsvFileLines } from './utils/storage-utils';

/**
 * Результат операции экспорта
 */
export interface ExportResult {
  success: boolean;
  exported: number;
  failed: number;
  errors: ExportError[];
}

/**
 * Ошибка экспорта
 */
export interface ExportError {
  commentId: string;
  error: string;
}

/**
 * Результат операции синхронизации
 */
export interface SyncResult {
  success: boolean;
  updated: number;
  checked: number;
  errors: SyncError[];
}

/**
 * Ошибка синхронизации
 */
export interface SyncError {
  commentId: string;
  issueId: string;
  error: string;
}

/**
 * Фабрика для операций с GitLab
 * Обрабатывает экспорт комментариев в задачи GitLab и синхронизацию статусов
 */
export class GitLabFactory {
  private client: GitLabClient | null = null;
  private templateEngine: TemplateEngine;
  private configManager: GitLabConfigManager;
  private outputChannel = window.createOutputChannel('GitLab Sync');

  constructor(
    private context: ExtensionContext,
    private workspaceRoot: string,
    private commentService: ReviewCommentService,
    private reviewFile: string,
  ) {
    this.configManager = new GitLabConfigManager(context);
    this.templateEngine = new TemplateEngine(context, this.configManager);
  }

  private log(message: string, ...args: any[]) {
    const fullMessage = args.length > 0 ? `${message} ${JSON.stringify(args)}` : message;
    this.outputChannel.appendLine(fullMessage);
    console.log(message, ...args);
  }

  /**
   * Инициализирует GitLab клиент с текущей конфигурацией
   * @returns Promise<boolean> true если инициализация успешна
   */
  private async initializeClient(): Promise<boolean> {
    const baseUrl = this.configManager.getBaseUrl();
    const projectId = this.configManager.getProjectId();
    const token = await this.configManager.getToken();

    if (!baseUrl || !projectId || !token) {
      return false;
    }

    this.client = new GitLabClient(baseUrl, token, projectId);
    return true;
  }

  /**
   * Экспортирует комментарии без issue_id в GitLab
   * @param comments Опциональный массив конкретных комментариев для экспорта
   * @returns Promise с результатом экспорта
   */
  async exportToGitLab(comments?: CsvEntry[]): Promise<ExportResult> {
    const result: ExportResult = {
      success: true,
      exported: 0,
      failed: 0,
      errors: [],
    };

    try {
      // Инициализация клиента
      if (!(await this.initializeClient())) {
        throw new Error('GitLab is not configured properly');
      }

      // Чтение комментариев из CSV
      let commentsToExport: CsvEntry[];
      if (comments && comments.length > 0) {
        // Экспорт конкретных комментариев
        commentsToExport = comments;
      } else {
        // Чтение всех комментариев из CSV
        const allComments = await this.readCommentsFromCsv();
        // Фильтрация комментариев без issue_id
        commentsToExport = allComments.filter((comment) => !comment.issue_id || comment.issue_id.trim() === '');
      }

      if (commentsToExport.length === 0) {
        window.showInformationMessage('No comments to export to GitLab');
        return result;
      }

      // Получение меток по умолчанию
      const defaultLabels = this.configManager.getDefaultLabels();

      // Цикл создания задач с обработкой ошибок
      for (const comment of commentsToExport) {
        try {
          // Рендеринг описания задачи из шаблона
          const description = this.templateEngine.renderIssueDescription(comment);

          // Формирование меток из приоритета и категории
          const labels = this.buildLabelsFromComment(comment, defaultLabels);

          // Поиск assignee по имени/username если указан
          let assigneeId: number | undefined;
          if (comment.assignee && comment.assignee.trim() !== '') {
            assigneeId = await this.findAssigneeId(comment.assignee);
            if (!assigneeId) {
              this.log(`[GitLab Export] Assignee "${comment.assignee}" not found for comment ${comment.id}`);
            }
          }

          // Создание задачи в GitLab
          const issue = await this.client!.createIssue({
            title: comment.title,
            description: description,
            labels: labels,
            assignee_id: assigneeId,
          });

          // Обновление CSV с полученным issue_id
          await this.updateCommentIssueId(comment.id, issue.iid.toString());

          result.exported++;
        } catch (error) {
          result.failed++;
          result.errors.push({
            commentId: comment.id,
            error: error instanceof Error ? error.message : String(error),
          });
          console.error(`Failed to export comment ${comment.id}:`, error);
        }
      }

      result.success = result.failed === 0;

      // Отображение сводки
      if (result.exported > 0) {
        window.showInformationMessage(
          `Successfully exported ${result.exported} comment(s) to GitLab` +
            (result.failed > 0 ? `. ${result.failed} failed.` : ''),
        );
      }

      if (result.failed > 0) {
        window.showWarningMessage(`Failed to export ${result.failed} comment(s). Check output for details.`);
      }
    } catch (error) {
      result.success = false;
      window.showErrorMessage(`Export to GitLab failed: ${error}`);
      console.error('Export to GitLab failed:', error);
    }

    return result;
  }

  /**
   * Синхронизирует статусы задач из GitLab
   * @returns Promise с результатом синхронизации
   */
  async syncStatuses(): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      updated: 0,
      checked: 0,
      errors: [],
    };

    try {
      // Инициализация клиента
      if (!(await this.initializeClient())) {
        throw new Error('GitLab is not configured properly');
      }

      // Чтение комментариев с непустым issue_id и статусом != "Closed"
      const allComments = await this.readCommentsFromCsv();
      const commentsToSync = allComments.filter(
        (comment) => comment.issue_id && comment.issue_id.trim() !== '' && comment.status !== 'Closed',
      );

      if (commentsToSync.length === 0) {
        window.showInformationMessage('No comments to sync with GitLab');
        return result;
      }

      // Группировка issue_id для батчинга (до 100 за раз)
      // Удаляем решетку (#) если она есть в начале issue_id
      const issueIds = commentsToSync.map((comment) => comment.issue_id.replace(/^#/, ''));
      const uniqueIssueIds = Array.from(new Set(issueIds));

      const baseUrl = this.configManager.getBaseUrl();
      const projectId = this.configManager.getProjectId();

      // Логи пишутся в Output Channel, но окно не открывается автоматически
      this.log(`[GitLab Sync] Configuration:`);
      this.log(`[GitLab Sync]   Base URL: ${baseUrl}`);
      this.log(`[GitLab Sync]   Project ID: ${projectId}`);
      this.log(`[GitLab Sync] Syncing ${commentsToSync.length} comments with ${uniqueIssueIds.length} unique issues`);
      this.log(`[GitLab Sync] Raw issue_ids from CSV:`, issueIds.slice(0, 10));
      this.log(`[GitLab Sync] Unique issue IIDs:`, uniqueIssueIds.slice(0, 10));
      this.log(
        `[GitLab Sync] Sample comments:`,
        commentsToSync.slice(0, 3).map((c) => ({
          id: c.id,
          title: c.title,
          issue_id: c.issue_id,
          issue_id_type: typeof c.issue_id,
          issue_id_length: c.issue_id?.length,
        })),
      );

      // Запросы к GitLab API для получения статусов задач
      const issues = await this.client!.getIssues(uniqueIssueIds);

      this.log(`[GitLab Sync] Found ${issues.length} issues in GitLab`);
      this.log(
        `[GitLab Sync] Found issue IIDs:`,
        issues.map((i) => i.iid),
      );

      // Создание карты issue_id -> issue для быстрого поиска
      const issueMap = new Map<string, GitLabIssue>();
      issues.forEach((issue) => {
        issueMap.set(issue.iid.toString(), issue);
      });

      // Определение отсутствующих issues
      const missingIssueIds = uniqueIssueIds.filter((iid) => !issueMap.has(iid));
      if (missingIssueIds.length > 0) {
        this.log(`[GitLab Sync] ${missingIssueIds.length} issues not found in GitLab:`, missingIssueIds);
        this.log(
          `[GitLab Sync] This may indicate: 1) Issues were deleted, 2) Wrong Project ID, 3) Issues in different project`,
        );
      }

      // Обновление статуса на "Check" для закрытых задач
      for (const comment of commentsToSync) {
        try {
          // Удаляем решетку (#) из issue_id перед поиском в Map
          const cleanIssueId = comment.issue_id.replace(/^#/, '');
          const issue = issueMap.get(cleanIssueId);

          if (!issue) {
            // Задача не найдена - это может быть нормально (удалена, другой проект и т.д.)
            this.log(`[GitLab Sync] Issue #${cleanIssueId} not found for comment ${comment.id} (${comment.title})`);
            result.errors.push({
              commentId: comment.id,
              issueId: comment.issue_id,
              error: 'Issue not found in GitLab (may be deleted or in different project)',
            });
            continue;
          }

          // Проверка состояния задачи
          if (issue.state === 'closed' && comment.status !== 'Check') {
            // Обновление статуса комментария на "Check"
            await this.updateCommentStatus(comment.id, 'Check');
            result.updated++;
            result.checked++;
          }
        } catch (error) {
          result.errors.push({
            commentId: comment.id,
            issueId: comment.issue_id,
            error: error instanceof Error ? error.message : String(error),
          });
          console.error(`Failed to sync comment ${comment.id}:`, error);
        }
      }

      result.success = result.errors.length === 0;

      // Отображение сводки
      if (result.updated > 0) {
        window.showInformationMessage(
          `Successfully synced ${result.updated} comment(s) with GitLab. ${result.checked} marked as "Check".`,
        );
      } else if (result.errors.length === 0) {
        window.showInformationMessage('All comments are already up to date');
      }

      if (result.errors.length > 0) {
        const notFoundCount = result.errors.filter((e) => e.error.includes('not found')).length;
        if (notFoundCount === result.errors.length) {
          // Все ошибки - это "not found"
          window.showWarningMessage(
            `${notFoundCount} issue(s) not found in GitLab. They may have been deleted or are in a different project. Check console for details.`,
          );
        } else {
          window.showWarningMessage(`Failed to sync ${result.errors.length} comment(s). Check console for details.`);
        }
      }
    } catch (error) {
      result.success = false;
      window.showErrorMessage(`Sync with GitLab failed: ${error}`);
      console.error('Sync with GitLab failed:', error);
    }

    return result;
  }

  /**
   * Получает URL задачи GitLab
   * @param issueId IID задачи
   * @returns Полный URL задачи
   */
  getIssueUrl(issueId: string): string {
    const baseUrl = this.configManager.getBaseUrl();
    const projectPath = this.configManager.getProjectPath();

    if (!baseUrl || !projectPath || !issueId) {
      return '';
    }

    // Удаление /api/v4 из базового URL если присутствует
    let cleanBaseUrl = baseUrl.replace(/\/api\/v4\/?$/, '');
    // Удаление завершающего слэша
    cleanBaseUrl = cleanBaseUrl.replace(/\/$/, '');

    // Удаление # из issueId если присутствует
    const cleanIssueId = issueId.replace(/^#/, '');

    // Используем формат /<projectPath>/-/issues/<issueId>
    // projectPath должен быть в формате namespace/project (например, limto_rss_centr/erp_yx)
    return `${cleanBaseUrl}/${projectPath}/-/issues/${cleanIssueId}`;
  }

  /**
   * Проверяет конфигурацию GitLab
   * @returns true если конфигурация валидна
   */
  async validateConfiguration(): Promise<boolean> {
    const validation = await this.configManager.validateConfiguration();
    return validation.valid;
  }

  /**
   * Тестирует получение конкретного issue по IID
   * @param iid IID issue для тестирования
   * @returns Promise с результатом теста
   */
  async testSingleIssue(iid: string): Promise<{
    found: boolean;
    issue?: any;
    error?: string;
  }> {
    try {
      // Инициализация клиента
      if (!(await this.initializeClient())) {
        throw new Error('GitLab is not configured properly');
      }

      // Удаляем решетку (#) если она есть
      const cleanIid = iid.replace(/^#/, '');
      console.log(`[GitLab Test] Testing single issue #${cleanIid} (original: ${iid})`);
      const issue = await this.client!.getIssue(cleanIid);

      if (issue) {
        console.log(`[GitLab Test] Issue found: #${issue.iid} - ${issue.title} [${issue.state}]`);
        return { found: true, issue };
      } else {
        console.log(`[GitLab Test] Issue #${iid} not found (returned null)`);
        return { found: false };
      }
    } catch (error) {
      console.error(`[GitLab Test] Error testing issue #${iid}:`, error);
      return { found: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Диагностирует проблемы с issue_id в комментариях
   * Проверяет, какие issues существуют в GitLab, а какие нет
   * @returns Promise с результатом диагностики
   */
  async diagnoseIssues(): Promise<{
    totalComments: number;
    commentsWithIssues: number;
    existingIssues: number;
    missingIssues: number;
    missingIssueIds: string[];
    issueDetails: Array<{ iid: string; title: string; state: string; web_url: string }>;
  }> {
    try {
      // Инициализация клиента
      if (!(await this.initializeClient())) {
        throw new Error('GitLab is not configured properly');
      }

      // Чтение всех комментариев
      const allComments = await this.readCommentsFromCsv();
      const commentsWithIssues = allComments.filter((c) => c.issue_id && c.issue_id.trim() !== '');

      if (commentsWithIssues.length === 0) {
        return {
          totalComments: allComments.length,
          commentsWithIssues: 0,
          existingIssues: 0,
          missingIssues: 0,
          missingIssueIds: [],
          issueDetails: [],
        };
      }

      // Получение уникальных issue_id
      // Удаляем решетку (#) если она есть в начале issue_id
      const uniqueIssueIds = Array.from(new Set(commentsWithIssues.map((c) => c.issue_id.replace(/^#/, ''))));

      // Запрос к GitLab
      const issues = await this.client!.getIssues(uniqueIssueIds);

      // Создание карты найденных issues
      const foundIssueIds = new Set(issues.map((i) => i.iid.toString()));
      const missingIssueIds = uniqueIssueIds.filter((iid) => !foundIssueIds.has(iid));

      // Формирование деталей найденных issues
      const issueDetails = issues.map((issue) => ({
        iid: issue.iid.toString(),
        title: issue.title,
        state: issue.state,
        web_url: issue.web_url,
      }));

      return {
        totalComments: allComments.length,
        commentsWithIssues: commentsWithIssues.length,
        existingIssues: issues.length,
        missingIssues: missingIssueIds.length,
        missingIssueIds,
        issueDetails,
      };
    } catch (error) {
      throw new Error(`Failed to diagnose issues: ${error}`);
    }
  }

  /**
   * Читает комментарии из CSV файла
   * @returns Promise с массивом комментариев
   */
  private async readCommentsFromCsv(): Promise<CsvEntry[]> {
    const parse = require('@fast-csv/parse');
    const fs = require('fs');

    return new Promise((resolve, reject) => {
      const comments: CsvEntry[] = [];

      fs.createReadStream(this.reviewFile)
        .pipe(parse.parse({ headers: true, ignoreEmpty: true }))
        .on('error', (error: Error) => reject(error))
        .on('data', (row: CsvEntry) => {
          // Финalize parse to handle escaped characters
          const { CsvStructure } = require('./model');
          comments.push(CsvStructure.finalizeParse(row));
        })
        .on('end', () => resolve(comments));
    });
  }

  /**
   * Обновляет issue_id комментария в CSV файле
   * @param commentId ID комментария
   * @param issueId IID задачи GitLab
   */
  private async updateCommentIssueId(commentId: string, issueId: string): Promise<void> {
    const rows = getCsvFileLinesAsArray(this.reviewFile);
    const updateRowIndex = rows.findIndex((row) => row.includes(commentId));

    if (updateRowIndex < 0) {
      throw new Error(`Cannot find comment with ID ${commentId} in ${this.reviewFile}`);
    }

    // Парсинг строки CSV
    const parse = require('@fast-csv/parse');
    const { CsvStructure } = require('./model');

    return new Promise((resolve, reject) => {
      let processed = false;
      parse
        .parseString(rows[updateRowIndex], { headers: CsvStructure.headers, renameHeaders: false })
        .on('error', (error: Error) => reject(error))
        .on('data', (row: CsvEntry) => {
          processed = true;
          // Обновление issue_id
          row.issue_id = issueId;
          // Форматирование обратно в CSV
          rows[updateRowIndex] = CsvStructure.formatAsCsvLine(row);
          // Сохранение обновленного файла
          setCsvFileLines(this.reviewFile, rows);
          resolve();
        })
        .on('end', () => {
          if (!processed) {
            reject(new Error(`Cannot parse comment with ID ${commentId} in ${this.reviewFile}`));
          }
        });
    });
  }

  /**
   * Обновляет статус комментария в CSV файле
   * @param commentId ID комментария
   * @param status Новый статус
   */
  private async updateCommentStatus(commentId: string, status: string): Promise<void> {
    const rows = getCsvFileLinesAsArray(this.reviewFile);
    const updateRowIndex = rows.findIndex((row) => row.includes(commentId));

    if (updateRowIndex < 0) {
      throw new Error(`Cannot find comment with ID ${commentId} in ${this.reviewFile}`);
    }

    // Парсинг строки CSV
    const parse = require('@fast-csv/parse');
    const { CsvStructure } = require('./model');

    return new Promise((resolve, reject) => {
      let processed = false;
      parse
        .parseString(rows[updateRowIndex], { headers: CsvStructure.headers, renameHeaders: false })
        .on('error', (error: Error) => reject(error))
        .on('data', (row: CsvEntry) => {
          processed = true;
          // Обновление статуса
          row.status = status;
          // Форматирование обратно в CSV
          rows[updateRowIndex] = CsvStructure.formatAsCsvLine(row);
          // Сохранение обновленного файла
          setCsvFileLines(this.reviewFile, rows);
          resolve();
        })
        .on('end', () => {
          if (!processed) {
            reject(new Error(`Cannot parse comment with ID ${commentId} in ${this.reviewFile}`));
          }
        });
    });
  }

  /**
   * Формирует массив меток из приоритета и категории комментария
   * @param comment Комментарий
   * @param defaultLabels Метки по умолчанию из конфигурации
   * @returns Массив меток для задачи GitLab
   */
  private buildLabelsFromComment(comment: CsvEntry, defaultLabels: string[]): string[] {
    const labels: string[] = [...defaultLabels];

    // Добавление метки приоритета
    if (comment.priority !== undefined && comment.priority !== null) {
      const priorityLabel = this.getPriorityLabel(comment.priority);
      if (priorityLabel) {
        labels.push(priorityLabel);
      }
    }

    // Добавление метки категории (нормализация: нижний регистр, пробелы → дефисы)
    if (comment.category && comment.category.trim() !== '') {
      const normalizedCategory = comment.category.trim().toLowerCase().replace(/\s+/g, '-');
      labels.push(normalizedCategory);
    }

    return labels;
  }

  /**
   * Получает метку приоритета на основе числового значения
   * @param priority Числовое значение приоритета (0-3)
   * @returns Метка приоритета или null
   */
  private getPriorityLabel(priority: number): string | null {
    switch (priority) {
      case 1:
        return 'minor';
      case 2:
        return 'major';
      case 3:
        return 'critical';
      default:
        return null; // Для priority = 0 (не указан) метку не добавляем
    }
  }

  /**
   * Ищет ID пользователя GitLab по имени или username
   * @param assigneeName Имя или username для поиска
   * @returns ID пользователя или undefined если не найден
   */
  private async findAssigneeId(assigneeName: string): Promise<number | undefined> {
    try {
      // Поиск пользователя по имени/username
      const users = await this.client!.searchUsers(assigneeName);

      if (users.length === 0) {
        return undefined;
      }

      // Ищем точное совпадение по username или name
      const exactMatch = users.find(
        (user) =>
          user.username.toLowerCase() === assigneeName.toLowerCase() ||
          user.name.toLowerCase() === assigneeName.toLowerCase(),
      );

      if (exactMatch) {
        this.log(`[GitLab Export] Found assignee: ${exactMatch.name} (@${exactMatch.username}) [ID: ${exactMatch.id}]`);
        return exactMatch.id;
      }

      // Если точного совпадения нет, берем первого из результатов
      const firstMatch = users[0];
      this.log(
        `[GitLab Export] Using first match for "${assigneeName}": ${firstMatch.name} (@${firstMatch.username}) [ID: ${firstMatch.id}]`,
      );
      return firstMatch.id;
    } catch (error) {
      this.log(`[GitLab Export] Error searching for assignee "${assigneeName}":`, error);
      return undefined;
    }
  }
}
