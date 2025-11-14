import * as path from 'path';
import * as fs from 'fs';
import { TextDecoder } from 'util';
import initSqlJs from 'sql.js';
import type { Database } from 'sql.js';

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

    // Нормализуем путь к проекту для сравнения
    // Если workspaceRoot пустой или '.', используем process.cwd()
    const workspaceRootToUse = !this.workspaceRoot || this.workspaceRoot === '.' ? process.cwd() : this.workspaceRoot;
    const projectPathResolved = path.resolve(workspaceRootToUse);
    const projectPathNormalized = projectPathResolved.toLowerCase().replace(/[\\/]+$/, '');

    // Ищем workspace по workspace.json
    const directories = fs.readdirSync(workspaceStoragePath);

    let checkedWorkspaces = 0;
    let workspacesWithJson = 0;
    const debugInfo: string[] = [];

    for (const dir of directories) {
      checkedWorkspaces++;
      const wsDir = path.join(workspaceStoragePath, dir);

      // Проверяем, что это директория
      try {
        if (!fs.statSync(wsDir).isDirectory()) {
          continue;
        }
      } catch {
        continue;
      }

      const workspaceJsonPath = path.join(wsDir, 'workspace.json');

      if (!fs.existsSync(workspaceJsonPath)) {
        continue;
      }

      workspacesWithJson++;

      try {
        const workspaceJson = JSON.parse(fs.readFileSync(workspaceJsonPath, 'utf-8'));
        let folderPath = workspaceJson.folder;

        if (!folderPath) {
          continue;
        }

        const originalPath = folderPath;

        // Обрабатываем формат URI (file:///e%3A/...) или обычный путь
        if (folderPath.startsWith('file:///')) {
          // Извлекаем путь из URI
          folderPath = folderPath.replace('file:///', '');
          folderPath = folderPath.replace(/\//g, '\\');
          // Декодируем URL-кодирование
          try {
            folderPath = decodeURIComponent(folderPath);
          } catch {
            // Игнорируем ошибки декодирования
          }
        }

        const folderPathResolved = path.resolve(folderPath);
        const folderPathNormalized = folderPathResolved.toLowerCase().replace(/[\\/]+$/, '');

        // Собираем отладочную информацию для первых 3 workspace
        if (workspacesWithJson <= 3) {
          debugInfo.push(`\nWorkspace ${workspacesWithJson} (${dir}):`);
          debugInfo.push(`  Original: ${originalPath}`);
          debugInfo.push(`  Decoded: ${folderPath}`);
          debugInfo.push(`  Normalized: ${folderPathNormalized}`);
          debugInfo.push(`  Match: ${folderPathNormalized === projectPathNormalized}`);
        }

        if (folderPathNormalized === projectPathNormalized) {
          const dbPath = path.join(wsDir, 'state.vscdb');
          const dbExists = fs.existsSync(dbPath);

          if (dbExists) {
            // Return the database path if it exists
            // Data validation will happen in extractReviews() with better error handling
            return dbPath;
          } else {
            debugInfo.push(`\nFound matching workspace but database file does not exist at: ${dbPath}`);
          }
        }
      } catch (error) {
        // Продолжаем поиск при ошибках чтения workspace.json
        continue;
      }
    }

    throw new Error(
      'CodeRabbit database not found in workspace storage. ' +
        'Please ensure CodeRabbit extension is installed in Cursor IDE and has performed at least one code review in this workspace. ' +
        `\n\nSearched in: ${workspaceStoragePath}` +
        `\nLooking for workspace: ${projectPathNormalized}` +
        `\nChecked ${checkedWorkspaces} directories, found ${workspacesWithJson} with workspace.json` +
        (debugInfo.length > 0 ? `\n\nDebug info:${debugInfo.join('\n')}` : ''),
    );
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

    let db: Database | undefined;

    try {
      // Initialize sql.js with locateFile to find the wasm file
      const SQL = await initSqlJs({
        locateFile: (file: string) => {
          // In production, the wasm file is in node_modules/sql.js/dist/
          return path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file);
        },
      });

      // Read database file
      const buffer = fs.readFileSync(dbPath);
      db = new SQL.Database(buffer);

      // Execute query
      const result = db.exec('SELECT value FROM ItemTable WHERE key = ?', ['coderabbit.coderabbit-vscode']);

      if (!result || result.length === 0 || !result[0].values || result[0].values.length === 0) {
        throw new Error(
          'CodeRabbit data not found in database. ' +
            'Please ensure CodeRabbit extension has performed at least one code review in this workspace.',
        );
      }

      // Get the value (first column of first row)
      const valueBuffer = result[0].values[0][0];

      // Распарсить JSON
      let data: any;
      try {
        // Convert buffer to string
        const jsonString =
          typeof valueBuffer === 'string'
            ? valueBuffer
            : Buffer.isBuffer(valueBuffer)
            ? valueBuffer.toString()
            : new TextDecoder().decode(valueBuffer as Uint8Array);

        data = JSON.parse(jsonString);
      } catch (error) {
        throw new Error(
          'Failed to parse CodeRabbit data from database. The database may be corrupted. ' +
            `Error: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      // Найти ключи вида *-reviews
      // Keys have format: "path-branch-reviews" or "path-branch/subbranch-reviews"
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
        // Extract branch name from key
        // Key format: "path-branch-reviews" or "path-branch/subbranch-reviews"
        // We need to extract just the branch part after the last path separator
        const keyWithoutReviews = key.replace('-reviews', '');

        // Try to extract branch name by removing workspace path prefix
        let branchName = keyWithoutReviews;

        // Normalize both paths for consistent comparison
        const normalizedWorkspaceRoot = this.workspaceRoot.toLowerCase().replace(/[\\/]/g, '\\');
        const normalizedKey = keyWithoutReviews.toLowerCase().replace(/[\\/]/g, '\\');

        if (normalizedKey.includes(normalizedWorkspaceRoot)) {
          // Remove workspace path and the separator using original keyWithoutReviews
          branchName = keyWithoutReviews.substring(normalizedWorkspaceRoot.length);
          // Remove leading separator if present
          if (branchName.startsWith('-') || branchName.startsWith('\\') || branchName.startsWith('/')) {
            branchName = branchName.substring(1);
          }
        }

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
