import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

/**
 * Представление задачи GitLab
 * Соответствует структуре ответа GitLab API v4
 */
export interface GitLabIssue {
  id: number;
  iid: number;
  project_id: number;
  title: string;
  description: string;
  state: 'opened' | 'closed';
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  labels: string[];
  web_url: string;
}

/**
 * Ошибка GitLab API
 */
export class GitLabApiError extends Error {
  constructor(message: string, public statusCode: number, public response?: any) {
    super(message);
    this.name = 'GitLabApiError';
  }
}

/**
 * Конфигурация повторных попыток
 */
interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
}

/**
 * Выполняет запрос с повторными попытками при ошибке 429
 * При ошибке 429 использует заголовок Retry-After
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = { maxRetries: 3, baseDelay: 1000, maxDelay: 60000 },
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Only retry on rate limit errors (429)
      if (error instanceof GitLabApiError && error.statusCode === 429) {
        // Don't retry if we've exhausted all attempts
        if (attempt === config.maxRetries) {
          break;
        }

        // Calculate delay
        let delay: number;
        if (error.response?.retryAfter) {
          // Use Retry-After header value (in seconds)
          delay = Math.min(error.response.retryAfter * 1000, config.maxDelay);
        } else {
          // Exponential backoff: 1s, 2s, 4s
          delay = Math.min(config.baseDelay * Math.pow(2, attempt), config.maxDelay);
        }

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // For non-429 errors, throw immediately
      throw error;
    }
  }

  throw lastError;
}

/**
 * Клиент для взаимодействия с GitLab API v4
 *
 * Базовый URL API: https://gitlab-sonarqube-sti.phoenixit.ru/api/v4
 */
export class GitLabClient {
  private baseUrl: string;
  private token: string;
  private projectId: string;

  constructor(baseUrl: string, token: string, projectId: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.token = token;
    this.projectId = projectId;
  }

  /**
   * Выполняет HTTP запрос к GitLab API
   */
  private async request<T>(method: string, path: string, body?: any): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    return new Promise((resolve, reject) => {
      const options: https.RequestOptions = {
        method,
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        headers: {
          'PRIVATE-TOKEN': this.token,
          'Content-Type': 'application/json',
        },
      };

      const req = httpModule.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          const statusCode = res.statusCode || 0;

          // Handle successful responses
          if (statusCode >= 200 && statusCode < 300) {
            try {
              const parsed = data ? JSON.parse(data) : {};
              resolve(parsed as T);
            } catch (error) {
              reject(new GitLabApiError('Failed to parse JSON response', statusCode, data));
            }
            return;
          }

          // Handle error responses
          let errorMessage = `GitLab API error: ${statusCode}`;
          let errorResponse: any;

          try {
            errorResponse = data ? JSON.parse(data) : {};
            if (errorResponse.message) {
              if (typeof errorResponse.message === 'string') {
                errorMessage = errorResponse.message;
              } else {
                errorMessage = JSON.stringify(errorResponse.message);
              }
            }
          } catch {
            errorMessage = data || errorMessage;
          }

          // Handle specific status codes
          switch (statusCode) {
            case 400:
              reject(new GitLabApiError(`Bad Request: ${errorMessage}`, statusCode, errorResponse));
              break;
            case 401:
              reject(
                new GitLabApiError('Unauthorized: Please check your Personal Access Token', statusCode, errorResponse),
              );
              break;
            case 403:
              reject(new GitLabApiError('Forbidden: Insufficient permissions', statusCode, errorResponse));
              break;
            case 404:
              reject(new GitLabApiError('Not Found: Resource does not exist', statusCode, errorResponse));
              break;
            case 422:
              reject(new GitLabApiError(`Validation Error: ${errorMessage}`, statusCode, errorResponse));
              break;
            case 429:
              const retryAfter = res.headers['retry-after'];
              reject(
                new GitLabApiError(`Rate Limit Exceeded. Retry after: ${retryAfter || '60'} seconds`, statusCode, {
                  retryAfter: retryAfter ? parseInt(retryAfter as string, 10) : 60,
                }),
              );
              break;
            case 500:
              reject(new GitLabApiError('Internal Server Error', statusCode, errorResponse));
              break;
            default:
              reject(new GitLabApiError(errorMessage, statusCode, errorResponse));
          }
        });
      });

      req.on('error', (error) => {
        reject(new GitLabApiError(`Network error: ${error.message}`, 0, error));
      });

      if (body) {
        req.write(JSON.stringify(body));
      }

      req.end();
    });
  }

  /**
   * Создает новую задачу в GitLab
   * API: POST /projects/:id/issues
   *
   * @param title Заголовок задачи (обязательный)
   * @param description Описание задачи (Markdown, необязательный)
   * @param labels Метки для задачи (необязательный)
   * @returns Promise с созданной задачей
   */
  async createIssue(title: string, description: string, labels?: string[]): Promise<GitLabIssue> {
    return withRetry(async () => {
      const body: any = {
        title,
        description,
      };

      if (labels && labels.length > 0) {
        body.labels = labels.join(',');
      }

      return this.request<GitLabIssue>('POST', `/api/v4/projects/${encodeURIComponent(this.projectId)}/issues`, body);
    });
  }

  /**
   * Получает задачу по IID
   * API: GET /projects/:id/issues/:issue_iid
   *
   * @param iid Внутренний ID задачи (IID)
   * @returns Promise с задачей или null если не найдена
   */
  async getIssue(iid: string): Promise<GitLabIssue | null> {
    return withRetry(async () => {
      try {
        return await this.request<GitLabIssue>(
          'GET',
          `/api/v4/projects/${encodeURIComponent(this.projectId)}/issues/${iid}`,
        );
      } catch (error) {
        if (error instanceof GitLabApiError && error.statusCode === 404) {
          return null;
        }
        throw error;
      }
    });
  }

  /**
   * Получает несколько задач по IID (батчинг)
   * API: GET /projects/:id/issues?iids[]=1&iids[]=2
   *
   * @param iids Массив внутренних ID задач (максимум 100)
   * @returns Promise с массивом задач
   */
  async getIssues(iids: string[]): Promise<GitLabIssue[]> {
    if (iids.length === 0) {
      return [];
    }

    // GitLab API supports up to 100 IIDs per request
    const batchSize = 100;
    const batches: string[][] = [];

    for (let i = 0; i < iids.length; i += batchSize) {
      batches.push(iids.slice(i, i + batchSize));
    }

    const results: GitLabIssue[] = [];

    for (const batch of batches) {
      const issues = await withRetry(async () => {
        const queryParams = batch.map((iid) => `iids[]=${iid}`).join('&');
        return this.request<GitLabIssue[]>(
          'GET',
          `/api/v4/projects/${encodeURIComponent(this.projectId)}/issues?${queryParams}`,
        );
      });
      results.push(...issues);
    }

    return results;
  }

  /**
   * Проверяет подключение к GitLab API
   * Выполняет тестовый запрос для валидации токена и доступа
   *
   * @returns Promise<boolean> true если подключение успешно
   */
  async testConnection(): Promise<boolean> {
    return withRetry(async () => {
      try {
        await this.request<any>('GET', `/api/v4/projects/${encodeURIComponent(this.projectId)}`);
        return true;
      } catch (error) {
        return false;
      }
    });
  }
}
