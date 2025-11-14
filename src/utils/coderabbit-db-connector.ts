import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import Database from 'better-sqlite3';

/**
 * Интерфейс замечания CodeRabbit
 */
export interface CodeRabbitComment {
  id: string;
  filename: string;
  startLine: number;
  endLine: number;
  comment: string;
  severity?: string;
  indicatorTypes?: string[];
  suggestions?: string[];
  analysis?: {
    chain?: string[];
  };
  resolution?: string;
}

/**
 * Интерфейс обзора файла CodeRabbit
 */
export interface CodeRabbitFileReview {
  comments: CodeRabbitComment[];
  status: number;
}

/**
 * Интерфейс обзора CodeRabbit
 */
export interface CodeRabbitReview {
  id: string;
  status: string;
  startedAt: string;
  endedAt: string;
  branch: string;
  fileReviewMap: Record<string, CodeRabbitFileReview>;
}

/**
 * Опции для фильтрации обзоров
 */
export interface CodeRabbitImportOptions {
  branch?: string;
  startDate?: string; // ISO 8601
  endDate?: string; // ISO 8601
  latestOnly?: boolean;
}

/**
 * Коннектор к базе данных CodeRabbit
 */
export class CodeRabbitDBConnector {
  constructor(private workspaceRoot: string) {}

  /**
   * Автоматический поиск workspace storage для текущего проекта
   */
  public async findWorkspacePath(): Promise<string> {
    const appDataPath = process.env.APPDATA || process.env.HOME;
    if (!appDataPath) {
      throw new Error(
        'Cannot determine application data directory. Please ensure APPDATA (Windows) or HOME (Unix) environment variable is set.',
      );
    }

    const workspaceStoragePath = path.join(appDataPath, 'Cursor', 'User', 'workspaceStorage');

    if (!fs.existsSync(workspaceStoragePath)) {
      throw new Error(
        `CodeRabbit database not found. Cursor workspace storage does not exist at: ${workspaceStoragePath}. ` +
          'Please ensure Cursor IDE is installed and CodeRabbit extension has been used in this workspace.',
      );
    }

    // Вычислить хеш пути workspace
    const workspaceHash = this.computeWorkspaceHash(this.workspaceRoot);
    const expectedPath = path.join(workspaceStoragePath, workspaceHash, 'state.vscdb');

    // Проверить ожидаемый путь
    if (fs.existsSync(expectedPath) && this.hasCodeRabbitData(expectedPath)) {
      return expectedPath;
    }

    // Fallback: поиск по всем директориям
    const directories = fs.readdirSync(workspaceStoragePath);
    for (const dir of directories) {
      const dbPath = path.join(workspaceStoragePath, dir, 'state.vscdb');
      if (fs.existsSync(dbPath) && this.hasCodeRabbitData(dbPath)) {
        return dbPath;
      }
    }

    throw new Error(
      'CodeRabbit database not found in workspace storage. ' +
        'Please ensure CodeRabbit extension is installed in Cursor IDE and has performed at least one code review in this workspace. ' +
        `Searched in: ${workspaceStoragePath}`,
    );
  }

  /**
   * Вычислить хеш пути workspace (аналогично Cursor IDE)
   */
  private computeWorkspaceHash(workspacePath: string): string {
    const normalizedPath = workspacePath.toLowerCase().replace(/\\/g, '/');
    return crypto.createHash('md5').update(normalizedPath).digest('hex');
  }

  /**
   * Проверить наличие данных CodeRabbit в базе
   */
  private hasCodeRabbitData(dbPath: string): boolean {
    let db: Database.Database | undefined;
    try {
      // Open in readonly mode with fileMustExist for better performance
      db = new Database(dbPath, { readonly: true, fileMustExist: true });

      // Use prepared statement for consistency
      const stmt = db.prepare('SELECT key FROM ItemTable WHERE key = ?');
      const row = stmt.get('coderabbit.coderabbit-vscode');

      return !!row;
    } catch (error) {
      // Silently fail - this is used for discovery
      return false;
    } finally {
      // Always close database connection to free resources
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore close errors during discovery
        }
      }
    }
  }

  /**
   * Извлечение обзоров из базы данных с фильтрацией
   */
  public async extractReviews(dbPath: string, options: CodeRabbitImportOptions = {}): Promise<CodeRabbitReview[]> {
    if (!fs.existsSync(dbPath)) {
      throw new Error(
        `CodeRabbit database file not found at: ${dbPath}. ` + 'The database may have been moved or deleted.',
      );
    }

    let db: Database.Database | undefined;

    try {
      // Open database in readonly mode for better performance
      db = new Database(dbPath, { readonly: true, fileMustExist: true });

      // Prepare statement for reuse (more efficient)
      const stmt = db.prepare('SELECT value FROM ItemTable WHERE key = ?');

      // Execute prepared statement
      const row = stmt.get('coderabbit.coderabbit-vscode') as { value: Buffer } | undefined;

      if (!row) {
        throw new Error(
          'CodeRabbit data not found in database. ' +
            'Please ensure CodeRabbit extension has performed at least one code review in this workspace.',
        );
      }

      // Распарсить JSON
      let data: any;
      try {
        data = JSON.parse(row.value.toString());
      } catch (error) {
        throw new Error(
          'Failed to parse CodeRabbit data from database. The database may be corrupted. ' +
            `Error: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      // Найти ключи вида *-reviews
      const reviewKeys = Object.keys(data).filter((key) => key.endsWith('-reviews'));

      if (reviewKeys.length === 0) {
        throw new Error(
          'No review data found in CodeRabbit database. ' +
            'Please ensure CodeRabbit has completed at least one code review.',
        );
      }

      let allReviews: CodeRabbitReview[] = [];

      // Извлечь массивы обзоров для каждой ветки
      for (const key of reviewKeys) {
        const branchName = key.replace('-reviews', '');
        const reviews = data[key];

        if (Array.isArray(reviews)) {
          const typedReviews = reviews.map((review) => ({
            ...review,
            branch: branchName,
          }));
          allReviews = allReviews.concat(typedReviews);
        }
      }

      // Применить фильтры
      allReviews = this.filterReviews(allReviews, options);

      return allReviews;
    } catch (error) {
      // Re-throw with better context if it's a database error
      if (error instanceof Error && error.message.includes('SQLITE')) {
        throw new Error(
          `Failed to read CodeRabbit database: ${error.message}. ` +
            'The database may be locked by another process or corrupted.',
        );
      }
      throw error;
    } finally {
      // Always close database connection to free resources
      if (db) {
        try {
          db.close();
        } catch (closeError) {
          // Log but don't throw - we want to preserve the original error if any
          console.error('Failed to close database connection:', closeError);
        }
      }
    }
  }

  /**
   * Фильтрация обзоров по критериям
   */
  private filterReviews(reviews: CodeRabbitReview[], options: CodeRabbitImportOptions): CodeRabbitReview[] {
    let filtered = reviews;

    // Фильтрация по ветке
    if (options.branch) {
      filtered = filtered.filter((review) => review.branch === options.branch);
    }

    // Фильтрация по диапазону дат
    if (options.startDate) {
      const startDate = new Date(options.startDate);
      filtered = filtered.filter((review) => new Date(review.endedAt) >= startDate);
    }

    if (options.endDate) {
      const endDate = new Date(options.endDate);
      filtered = filtered.filter((review) => new Date(review.endedAt) <= endDate);
    }

    // Фильтрация "последний обзор"
    if (options.latestOnly && filtered.length > 0) {
      const latest = filtered.reduce((prev, current) =>
        new Date(current.endedAt) > new Date(prev.endedAt) ? current : prev,
      );
      filtered = [latest];
    }

    return filtered;
  }

  /**
   * Извлечение всех замечаний из обзоров
   */
  public extractComments(reviews: CodeRabbitReview[]): { comments: CodeRabbitComment[]; skippedResolved: number } {
    const allComments: CodeRabbitComment[] = [];

    for (const review of reviews) {
      if (review.fileReviewMap) {
        for (const [filename, fileReview] of Object.entries(review.fileReviewMap)) {
          if (fileReview.comments && Array.isArray(fileReview.comments)) {
            // Добавить filename к каждому замечанию, если его нет
            const comments = fileReview.comments.map((comment) => ({
              ...comment,
              filename: comment.filename || filename,
            }));
            allComments.push(...comments);
          }
        }
      }
    }

    // Фильтрация по статусу обработки
    return this.filterByResolution(allComments);
  }

  /**
   * Фильтрация замечаний по статусу обработки
   */
  private filterByResolution(comments: CodeRabbitComment[]): {
    comments: CodeRabbitComment[];
    skippedResolved: number;
  } {
    let skippedResolved = 0;
    const filtered = comments.filter((comment) => {
      const resolution = comment.resolution;
      const shouldSkip = resolution === 'ignore' || resolution === 'applySuggestion' || resolution === 'fixWithAI';
      if (shouldSkip) {
        skippedResolved++;
      }
      return !shouldSkip;
    });

    return { comments: filtered, skippedResolved };
  }
}
