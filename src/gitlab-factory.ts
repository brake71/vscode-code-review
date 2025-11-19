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

  constructor(
    private context: ExtensionContext,
    private workspaceRoot: string,
    private commentService: ReviewCommentService,
    private reviewFile: string,
  ) {
    this.configManager = new GitLabConfigManager(context);
    this.templateEngine = new TemplateEngine(context, this.configManager);
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

          // Создание задачи в GitLab
          const issue = await this.client!.createIssue({
            title: comment.title,
            description: description,
            labels: defaultLabels,
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
      const issueIds = commentsToSync.map((comment) => comment.issue_id);
      const uniqueIssueIds = Array.from(new Set(issueIds));

      // Запросы к GitLab API для получения статусов задач
      const issues = await this.client!.getIssues(uniqueIssueIds);

      // Создание карты issue_id -> issue для быстрого поиска
      const issueMap = new Map<string, GitLabIssue>();
      issues.forEach((issue) => {
        issueMap.set(issue.iid.toString(), issue);
      });

      // Обновление статуса на "Check" для закрытых задач
      for (const comment of commentsToSync) {
        try {
          const issue = issueMap.get(comment.issue_id);

          if (!issue) {
            // Задача не найдена (404)
            console.warn(`Issue #${comment.issue_id} not found for comment ${comment.id}`);
            result.errors.push({
              commentId: comment.id,
              issueId: comment.issue_id,
              error: 'Issue not found',
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
      } else {
        window.showInformationMessage('All comments are already up to date');
      }

      if (result.errors.length > 0) {
        window.showWarningMessage(`Failed to sync ${result.errors.length} comment(s). Check output for details.`);
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
    const projectId = this.configManager.getProjectId();

    if (!baseUrl || !projectId || !issueId) {
      return '';
    }

    // Удаление /api/v4 из базового URL если присутствует
    let cleanBaseUrl = baseUrl.replace(/\/api\/v4\/?$/, '');
    // Удаление завершающего слэша
    cleanBaseUrl = cleanBaseUrl.replace(/\/$/, '');

    // Проверка, является ли projectId числовым ID
    if (/^\d+$/.test(projectId)) {
      // Для числового ID используем формат /projects/<id>/-/issues/<issueId>
      return `${cleanBaseUrl}/projects/${projectId}/-/issues/${issueId}`;
    } else {
      // Для пути (namespace/project) используем формат /<projectId>/-/issues/<issueId>
      return `${cleanBaseUrl}/${projectId}/-/issues/${issueId}`;
    }
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
}
