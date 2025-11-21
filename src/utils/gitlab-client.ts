import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

/**
 * Пользователь GitLab
 */
export interface GitLabUser {
  id: number;
  name: string;
  username: string;
  state: string;
  locked: boolean;
  avatar_url: string | null;
  web_url: string;
}

/**
 * Веха (Milestone) GitLab
 */
export interface GitLabMilestone {
  id: number;
  iid: number;
  project_id: number;
  title: string;
  description: string | null;
  state: 'active' | 'closed';
  created_at: string;
  updated_at: string;
  due_date: string | null;
  start_date: string | null;
  web_url: string;
}

/**
 * Статистика времени
 */
export interface TimeStats {
  time_estimate: number;
  total_time_spent: number;
  human_time_estimate: string | null;
  human_total_time_spent: string | null;
}

/**
 * Статус выполнения задач
 */
export interface TaskCompletionStatus {
  count: number;
  completed_count: number;
}

/**
 * Ссылки задачи
 */
export interface IssueLinks {
  self: string;
  notes: string;
  award_emoji: string;
  project: string;
  closed_as_duplicate_of: string | null;
}

/**
 * Ссылки на задачу
 */
export interface IssueReferences {
  short: string;
  relative: string;
  full: string;
}

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
  closed_by: GitLabUser | null;
  labels: string[];
  milestone: GitLabMilestone | null;
  assignees: GitLabUser[];
  author: GitLabUser;
  type: string;
  assignee: GitLabUser | null;
  user_notes_count: number;
  merge_requests_count: number;
  upvotes: number;
  downvotes: number;
  due_date: string | null;
  confidential: boolean;
  discussion_locked: boolean | null;
  issue_type: 'issue' | 'incident' | 'test_case' | 'requirement';
  web_url: string;
  time_stats: TimeStats;
  task_completion_status: TaskCompletionStatus;
  has_tasks: boolean;
  task_status: string;
  weight?: number;
  _links: IssueLinks;
  references: IssueReferences;
  severity: string;
  subscribed: boolean;
  moved_to_id: number | null;
  imported: boolean;
  imported_from: string;
  service_desk_reply_to: string | null;
}

/**
 * Комментарий (Note) GitLab
 */
export interface GitLabNote {
  id: number;
  type: string | null;
  body: string;
  attachment: string | null;
  author: GitLabUser;
  created_at: string;
  updated_at: string;
  system: boolean;
  noteable_id: number;
  noteable_type: string;
  project_id: number;
  resolvable: boolean;
  confidential: boolean;
  internal: boolean;
  imported: boolean;
  imported_from: string;
  noteable_iid: number;
  commands_changes: Record<string, any>;
}

/**
 * Параметры создания задачи
 */
export interface CreateIssueParams {
  title: string;
  description?: string;
  confidential?: boolean;
  assignee_ids?: number[];
  assignee_id?: number;
  milestone_id?: number;
  labels?: string[];
  created_at?: string;
  due_date?: string;
  merge_request_to_resolve_discussions_of?: number;
  discussion_to_resolve?: string;
  weight?: number;
  epic_id?: number;
  epic_iid?: number;
  issue_type?: 'issue' | 'incident' | 'test_case' | 'requirement';
}

/**
 * Параметры обновления задачи
 */
export interface UpdateIssueParams {
  title?: string;
  description?: string;
  confidential?: boolean;
  assignee_ids?: number[];
  assignee_id?: number;
  milestone_id?: number | null;
  labels?: string[];
  add_labels?: string[];
  remove_labels?: string[];
  due_date?: string | null;
  state_event?: 'close' | 'reopen';
  weight?: number | null;
  discussion_locked?: boolean;
  issue_type?: 'issue' | 'incident' | 'test_case' | 'requirement';
}

/**
 * Параметры создания комментария
 */
export interface CreateNoteParams {
  body: string;
  created_at?: string;
  internal?: boolean;
}

/**
 * Параметры обновления комментария
 */
export interface UpdateNoteParams {
  body: string;
}

/**
 * Информация о пагинации
 */
export interface PaginationInfo {
  total: number;
  totalPages: number;
  perPage: number;
  page: number;
  nextPage: number | null;
  prevPage: number | null;
}

/**
 * Результат с пагинацией
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationInfo;
}

/**
 * Ошибка GitLab API
 */
export class GitLabApiError extends Error {
  constructor(message: string, public statusCode: number, public response?: any, public details?: string) {
    super(message);
    this.name = 'GitLabApiError';
  }

  /**
   * Возвращает детальное описание ошибки для пользователя
   */
  getUserMessage(): string {
    const baseMessage = this.message;

    if (this.details) {
      return `${baseMessage}\n\nДетали: ${this.details}`;
    }

    switch (this.statusCode) {
      case 400:
        return `${baseMessage}\n\nПроверьте корректность переданных данных.`;
      case 401:
        return `${baseMessage}\n\nПроверьте правильность Personal Access Token в настройках.`;
      case 403:
        return `${baseMessage}\n\nУбедитесь, что токен имеет необходимые права доступа (api или write_api).`;
      case 404:
        return `${baseMessage}\n\nПроверьте правильность Project ID и существование ресурса.`;
      case 422:
        return `${baseMessage}\n\nДанные не прошли валидацию на сервере.`;
      case 429:
        return `${baseMessage}\n\nПревышен лимит запросов. Подождите и повторите попытку.`;
      case 500:
        return `${baseMessage}\n\nВнутренняя ошибка сервера GitLab. Попробуйте позже.`;
      default:
        return baseMessage;
    }
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

  for (let attempt = 0; attempt < config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Only retry on rate limit errors (429)
      if (error instanceof GitLabApiError && error.statusCode === 429) {
        // Don't retry if we've exhausted all attempts
        if (attempt === config.maxRetries - 1) {
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
  private requestTimeoutMs: number;

  constructor(baseUrl: string, token: string, projectId: string, requestTimeoutMs: number = 30000) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.token = token;
    this.projectId = projectId;
    this.requestTimeoutMs = requestTimeoutMs;
  }

  /**
   * Выполняет HTTP запрос к GitLab API
   */
  private async request<T>(method: string, path: string, body?: any): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    return new Promise((resolve, reject) => {
      let isResolved = false;

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
          if (isResolved) {
            return;
          }
          isResolved = true;

          const statusCode = res.statusCode || 0;

          // Handle successful responses
          if (statusCode >= 200 && statusCode < 300) {
            try {
              const parsed = data ? JSON.parse(data) : {};
              resolve(parsed as T);
            } catch (error) {
              reject(
                new GitLabApiError(
                  'Failed to parse JSON response',
                  statusCode,
                  data,
                  'Ответ сервера не является валидным JSON',
                ),
              );
            }
            return;
          }

          // Handle error responses
          let errorMessage = `GitLab API error: ${statusCode}`;
          let errorResponse: any;
          let errorDetails = '';

          try {
            errorResponse = data ? JSON.parse(data) : {};
            if (errorResponse.message) {
              if (typeof errorResponse.message === 'string') {
                errorMessage = errorResponse.message;
              } else if (typeof errorResponse.message === 'object') {
                // Форматирование объекта ошибок валидации
                const errors = Object.entries(errorResponse.message)
                  .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(', ') : messages}`)
                  .join('; ');
                errorDetails = errors;
                errorMessage = 'Validation failed';
              } else {
                errorMessage = JSON.stringify(errorResponse.message);
              }
            }
            if (errorResponse.error) {
              errorDetails = errorDetails ? `${errorDetails}; ${errorResponse.error}` : errorResponse.error;
            }
          } catch {
            errorMessage = data || errorMessage;
          }

          // Handle specific status codes
          switch (statusCode) {
            case 400:
              reject(
                new GitLabApiError(
                  `Bad Request: ${errorMessage}`,
                  statusCode,
                  errorResponse,
                  errorDetails || 'Некорректный запрос. Проверьте параметры.',
                ),
              );
              break;
            case 401:
              reject(
                new GitLabApiError(
                  'Unauthorized: Please check your Personal Access Token',
                  statusCode,
                  errorResponse,
                  'Токен доступа недействителен или отсутствует. Проверьте настройки.',
                ),
              );
              break;
            case 403:
              reject(
                new GitLabApiError(
                  'Forbidden: Insufficient permissions',
                  statusCode,
                  errorResponse,
                  'Недостаточно прав доступа. Убедитесь, что токен имеет права api или write_api.',
                ),
              );
              break;
            case 404:
              reject(
                new GitLabApiError(
                  'Not Found: Resource does not exist',
                  statusCode,
                  errorResponse,
                  'Ресурс не найден. Проверьте Project ID и существование объекта.',
                ),
              );
              break;
            case 422:
              reject(
                new GitLabApiError(
                  `Validation Error: ${errorMessage}`,
                  statusCode,
                  errorResponse,
                  errorDetails || 'Данные не прошли валидацию на сервере.',
                ),
              );
              break;
            case 429: {
              const retryAfter = res.headers['retry-after'];
              const retrySeconds = retryAfter ? parseInt(retryAfter as string, 10) : 60;
              reject(
                new GitLabApiError(
                  `Rate Limit Exceeded. Retry after: ${retrySeconds} seconds`,
                  statusCode,
                  {
                    retryAfter: retrySeconds,
                  },
                  `Превышен лимит запросов к API. Повторите попытку через ${retrySeconds} секунд.`,
                ),
              );
              break;
            }
            case 500:
              reject(
                new GitLabApiError(
                  'Internal Server Error',
                  statusCode,
                  errorResponse,
                  'Внутренняя ошибка сервера GitLab. Попробуйте позже или обратитесь к администратору.',
                ),
              );
              break;
            default:
              reject(new GitLabApiError(errorMessage, statusCode, errorResponse, errorDetails));
          }
        });
      });

      req.on('error', (error) => {
        if (isResolved) {
          return;
        }
        isResolved = true;
        reject(
          new GitLabApiError(
            `Network error: ${error.message}`,
            0,
            error,
            'Ошибка сети. Проверьте подключение к серверу GitLab.',
          ),
        );
      });

      // Set timeout handler
      req.setTimeout(this.requestTimeoutMs, () => {
        if (isResolved) {
          return;
        }
        isResolved = true;
        req.destroy();
        reject(
          new GitLabApiError(
            `Request timeout after ${this.requestTimeoutMs}ms: ${method} ${path}`,
            0,
            { method, path, timeout: this.requestTimeoutMs },
            `Превышено время ожидания ответа (${this.requestTimeoutMs}ms). Проверьте доступность сервера.`,
          ),
        );
      });

      if (body) {
        req.write(JSON.stringify(body));
      }

      req.end();
    });
  }

  /**
   * Выполняет HTTP запрос к GitLab API с поддержкой пагинации
   */
  private async requestWithPagination<T>(method: string, path: string, body?: any): Promise<PaginatedResult<T>> {
    const url = new URL(`${this.baseUrl}${path}`);
    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    return new Promise((resolve, reject) => {
      let isResolved = false;

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
          if (isResolved) {
            return;
          }
          isResolved = true;

          const statusCode = res.statusCode || 0;

          // Handle successful responses
          if (statusCode >= 200 && statusCode < 300) {
            try {
              const parsed = data ? JSON.parse(data) : [];

              // Извлечение информации о пагинации из заголовков
              const pagination: PaginationInfo = {
                total: parseInt(res.headers['x-total'] as string, 10) || 0,
                totalPages: parseInt(res.headers['x-total-pages'] as string, 10) || 0,
                perPage: parseInt(res.headers['x-per-page'] as string, 10) || 0,
                page: parseInt(res.headers['x-page'] as string, 10) || 0,
                nextPage: res.headers['x-next-page'] ? parseInt(res.headers['x-next-page'] as string, 10) : null,
                prevPage: res.headers['x-prev-page'] ? parseInt(res.headers['x-prev-page'] as string, 10) : null,
              };

              resolve({
                data: parsed as T[],
                pagination,
              });
            } catch (error) {
              reject(
                new GitLabApiError(
                  'Failed to parse JSON response',
                  statusCode,
                  data,
                  'Ответ сервера не является валидным JSON',
                ),
              );
            }
            return;
          }

          // Handle error responses (same as regular request)
          let errorMessage = `GitLab API error: ${statusCode}`;
          let errorResponse: any;
          let errorDetails = '';

          try {
            errorResponse = data ? JSON.parse(data) : {};
            if (errorResponse.message) {
              if (typeof errorResponse.message === 'string') {
                errorMessage = errorResponse.message;
              } else if (typeof errorResponse.message === 'object') {
                const errors = Object.entries(errorResponse.message)
                  .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(', ') : messages}`)
                  .join('; ');
                errorDetails = errors;
                errorMessage = 'Validation failed';
              } else {
                errorMessage = JSON.stringify(errorResponse.message);
              }
            }
            if (errorResponse.error) {
              errorDetails = errorDetails ? `${errorDetails}; ${errorResponse.error}` : errorResponse.error;
            }
          } catch {
            errorMessage = data || errorMessage;
          }

          reject(new GitLabApiError(errorMessage, statusCode, errorResponse, errorDetails));
        });
      });

      req.on('error', (error) => {
        if (isResolved) {
          return;
        }
        isResolved = true;
        reject(
          new GitLabApiError(
            `Network error: ${error.message}`,
            0,
            error,
            'Ошибка сети. Проверьте подключение к серверу GitLab.',
          ),
        );
      });

      req.setTimeout(this.requestTimeoutMs, () => {
        if (isResolved) {
          return;
        }
        isResolved = true;
        req.destroy();
        reject(
          new GitLabApiError(
            `Request timeout after ${this.requestTimeoutMs}ms: ${method} ${path}`,
            0,
            { method, path, timeout: this.requestTimeoutMs },
            `Превышено время ожидания ответа (${this.requestTimeoutMs}ms). Проверьте доступность сервера.`,
          ),
        );
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
   * @param params Параметры создания задачи
   * @returns Promise с созданной задачей
   */
  async createIssue(params: CreateIssueParams): Promise<GitLabIssue> {
    return withRetry(async () => {
      const body: any = {
        title: params.title,
      };

      if (params.description) {
        body.description = params.description;
      }
      if (params.confidential !== undefined) {
        body.confidential = params.confidential;
      }
      if (params.assignee_ids && params.assignee_ids.length > 0) {
        body.assignee_ids = params.assignee_ids;
      }
      if (params.assignee_id) {
        body.assignee_id = params.assignee_id;
      }
      if (params.milestone_id) {
        body.milestone_id = params.milestone_id;
      }
      if (params.labels && params.labels.length > 0) {
        body.labels = params.labels.join(',');
      }
      if (params.created_at) {
        body.created_at = params.created_at;
      }
      if (params.due_date) {
        body.due_date = params.due_date;
      }
      if (params.merge_request_to_resolve_discussions_of) {
        body.merge_request_to_resolve_discussions_of = params.merge_request_to_resolve_discussions_of;
      }
      if (params.discussion_to_resolve) {
        body.discussion_to_resolve = params.discussion_to_resolve;
      }
      if (params.weight !== undefined) {
        body.weight = params.weight;
      }
      if (params.epic_id) {
        body.epic_id = params.epic_id;
      }
      if (params.epic_iid) {
        body.epic_iid = params.epic_iid;
      }
      if (params.issue_type) {
        body.issue_type = params.issue_type;
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
        // Добавляем state=all чтобы получить и открытые, и закрытые issues
        // Добавляем per_page=100 чтобы получить все результаты (максимум 100 за раз)
        const url = `/api/v4/projects/${encodeURIComponent(
          this.projectId,
        )}/issues?${queryParams}&state=all&per_page=100`;
        console.log(`[GitLab API] Requesting batch of ${batch.length} issues: [${batch.join(', ')}]`);
        console.log(`[GitLab API] GET ${this.baseUrl}${url}`);
        const result = await this.request<GitLabIssue[]>('GET', url);
        console.log(
          `[GitLab API] Received ${result.length} issues with IIDs: [${result.map((i) => i.iid).join(', ')}]`,
        );
        return result;
      });
      results.push(...issues);
    }

    return results;
  }

  /**
   * Обновляет существующую задачу в GitLab
   * API: PUT /projects/:id/issues/:issue_iid
   *
   * @param iid Внутренний ID задачи (IID)
   * @param params Параметры обновления задачи
   * @returns Promise с обновленной задачей
   */
  async updateIssue(iid: string, params: UpdateIssueParams): Promise<GitLabIssue> {
    return withRetry(async () => {
      const body: any = {};

      if (params.title) {
        body.title = params.title;
      }
      if (params.description !== undefined) {
        body.description = params.description;
      }
      if (params.confidential !== undefined) {
        body.confidential = params.confidential;
      }
      if (params.assignee_ids !== undefined) {
        body.assignee_ids = params.assignee_ids;
      }
      if (params.assignee_id !== undefined) {
        body.assignee_id = params.assignee_id;
      }
      if (params.milestone_id !== undefined) {
        body.milestone_id = params.milestone_id;
      }
      if (params.labels !== undefined) {
        body.labels = params.labels.join(',');
      }
      if (params.add_labels !== undefined) {
        body.add_labels = params.add_labels.join(',');
      }
      if (params.remove_labels !== undefined) {
        body.remove_labels = params.remove_labels.join(',');
      }
      if (params.due_date !== undefined) {
        body.due_date = params.due_date;
      }
      if (params.state_event) {
        body.state_event = params.state_event;
      }
      if (params.weight !== undefined) {
        body.weight = params.weight;
      }
      if (params.discussion_locked !== undefined) {
        body.discussion_locked = params.discussion_locked;
      }
      if (params.issue_type) {
        body.issue_type = params.issue_type;
      }

      return this.request<GitLabIssue>(
        'PUT',
        `/api/v4/projects/${encodeURIComponent(this.projectId)}/issues/${iid}`,
        body,
      );
    });
  }

  /**
   * Удаляет задачу из GitLab
   * API: DELETE /projects/:id/issues/:issue_iid
   *
   * @param iid Внутренний ID задачи (IID)
   * @returns Promise с удаленной задачей
   */
  async deleteIssue(iid: string): Promise<GitLabIssue> {
    return withRetry(async () => {
      return this.request<GitLabIssue>(
        'DELETE',
        `/api/v4/projects/${encodeURIComponent(this.projectId)}/issues/${iid}`,
      );
    });
  }

  /**
   * Получает список комментариев к задаче
   * API: GET /projects/:id/issues/:issue_iid/notes
   *
   * @param issueIid Внутренний ID задачи (IID)
   * @param page Номер страницы (опционально)
   * @param perPage Количество элементов на странице (опционально, максимум 100)
   * @returns Promise с массивом комментариев и информацией о пагинации
   */
  async getNotes(issueIid: string, page?: number, perPage?: number): Promise<PaginatedResult<GitLabNote>> {
    return withRetry(async () => {
      let queryParams = '';
      const params: string[] = [];

      if (page) {
        params.push(`page=${page}`);
      }
      if (perPage) {
        params.push(`per_page=${Math.min(perPage, 100)}`);
      }

      if (params.length > 0) {
        queryParams = '?' + params.join('&');
      }

      return this.requestWithPagination<GitLabNote>(
        'GET',
        `/api/v4/projects/${encodeURIComponent(this.projectId)}/issues/${issueIid}/notes${queryParams}`,
      );
    });
  }

  /**
   * Создает новый комментарий к задаче
   * API: POST /projects/:id/issues/:issue_iid/notes
   *
   * @param issueIid Внутренний ID задачи (IID)
   * @param params Параметры создания комментария
   * @returns Promise с созданным комментарием
   */
  async createNote(issueIid: string, params: CreateNoteParams): Promise<GitLabNote> {
    return withRetry(async () => {
      const body: any = {
        body: params.body,
      };

      if (params.created_at) {
        body.created_at = params.created_at;
      }
      if (params.internal !== undefined) {
        body.internal = params.internal;
      }

      return this.request<GitLabNote>(
        'POST',
        `/api/v4/projects/${encodeURIComponent(this.projectId)}/issues/${issueIid}/notes`,
        body,
      );
    });
  }

  /**
   * Обновляет существующий комментарий к задаче
   * API: PUT /projects/:id/issues/:issue_iid/notes/:note_id
   *
   * @param issueIid Внутренний ID задачи (IID)
   * @param noteId ID комментария
   * @param params Параметры обновления комментария
   * @returns Promise с обновленным комментарием
   */
  async updateNote(issueIid: string, noteId: number, params: UpdateNoteParams): Promise<GitLabNote> {
    return withRetry(async () => {
      const body: any = {
        body: params.body,
      };

      return this.request<GitLabNote>(
        'PUT',
        `/api/v4/projects/${encodeURIComponent(this.projectId)}/issues/${issueIid}/notes/${noteId}`,
        body,
      );
    });
  }

  /**
   * Удаляет комментарий к задаче
   * API: DELETE /projects/:id/issues/:issue_iid/notes/:note_id
   *
   * @param issueIid Внутренний ID задачи (IID)
   * @param noteId ID комментария
   * @returns Promise (успешное удаление возвращает пустой ответ)
   */
  async deleteNote(issueIid: string, noteId: number): Promise<void> {
    return withRetry(async () => {
      await this.request<void>(
        'DELETE',
        `/api/v4/projects/${encodeURIComponent(this.projectId)}/issues/${issueIid}/notes/${noteId}`,
      );
    });
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
