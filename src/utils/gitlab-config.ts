import { ExtensionContext, workspace, window } from 'vscode';

/**
 * Менеджер конфигурации GitLab
 * Управляет настройками GitLab и безопасным хранением токена
 */
export class GitLabConfigManager {
  private static readonly tokenKey = 'code-review.gitlab.token';

  constructor(private context: ExtensionContext) {}

  /**
   * Получает базовый URL GitLab из настроек
   * @returns Базовый URL или undefined если не настроен
   */
  getBaseUrl(): string | undefined {
    const config = workspace.getConfiguration('code-review.gitlab');
    const baseUrl = config.get<string>('baseUrl');
    return baseUrl && baseUrl.trim() !== '' ? baseUrl.trim() : undefined;
  }

  /**
   * Получает Project ID из настроек
   * @returns Project ID или undefined если не настроен
   */
  getProjectId(): string | undefined {
    const config = workspace.getConfiguration('code-review.gitlab');
    const projectId = config.get<string>('projectId');
    return projectId && projectId.trim() !== '' ? projectId.trim() : undefined;
  }

  /**
   * Получает Personal Access Token из секретного хранилища VS Code
   * @returns Promise с токеном или undefined если не настроен
   */
  async getToken(): Promise<string | undefined> {
    const token = await this.context.secrets.get(GitLabConfigManager.tokenKey);
    return token && token.trim() !== '' ? token.trim() : undefined;
  }

  /**
   * Сохраняет Personal Access Token в секретное хранилище VS Code
   * @param token Токен для сохранения
   */
  async setToken(token: string): Promise<void> {
    if (!token || token.trim() === '') {
      throw new Error('Token cannot be empty');
    }
    await this.context.secrets.store(GitLabConfigManager.tokenKey, token.trim());
  }

  /**
   * Удаляет Personal Access Token из секретного хранилища
   */
  async deleteToken(): Promise<void> {
    await this.context.secrets.delete(GitLabConfigManager.tokenKey);
  }

  /**
   * Получает путь к пользовательскому шаблону задачи
   * @returns Путь к шаблону или undefined если не настроен
   */
  getIssueTemplatePath(): string | undefined {
    const config = workspace.getConfiguration('code-review.gitlab');
    const templatePath = config.get<string>('issueTemplatePath');
    return templatePath && templatePath.trim() !== '' ? templatePath.trim() : undefined;
  }

  /**
   * Получает метки по умолчанию для создаваемых задач
   * @returns Массив меток
   */
  getDefaultLabels(): string[] {
    const config = workspace.getConfiguration('code-review.gitlab');
    const labels = config.get<string[]>('defaultLabels');
    return labels || ['code-review'];
  }

  /**
   * Проверяет, настроена ли конфигурация GitLab
   * @returns true если все обязательные настройки заполнены
   */
  async isConfigured(): Promise<boolean> {
    const baseUrl = this.getBaseUrl();
    const projectId = this.getProjectId();
    const token = await this.getToken();

    return !!(baseUrl && projectId && token);
  }

  /**
   * Валидирует конфигурацию GitLab
   * @returns Объект с результатом валидации и сообщением об ошибке
   */
  async validateConfiguration(): Promise<{ valid: boolean; error?: string }> {
    // Проверка базового URL
    const baseUrl = this.getBaseUrl();
    if (!baseUrl) {
      return { valid: false, error: 'GitLab Base URL is not configured' };
    }

    // Валидация формата URL
    if (!this.isValidUrl(baseUrl)) {
      return { valid: false, error: 'GitLab Base URL is not a valid URL' };
    }

    // Проверка Project ID
    const projectId = this.getProjectId();
    if (!projectId) {
      return { valid: false, error: 'GitLab Project ID is not configured' };
    }

    // Валидация формата Project ID (число или путь вида group/project)
    if (!this.isValidProjectId(projectId)) {
      return {
        valid: false,
        error: 'GitLab Project ID must be a number or a path (e.g., "group/project")',
      };
    }

    // Проверка токена
    const token = await this.getToken();
    if (!token) {
      return { valid: false, error: 'GitLab Personal Access Token is not configured' };
    }

    // Валидация формата токена (должен начинаться с glpat- для новых токенов)
    if (!this.isValidToken(token)) {
      return {
        valid: false,
        error:
          'GitLab Personal Access Token format is invalid (should start with "glpat-" or be at least 20 characters)',
      };
    }

    return { valid: true };
  }

  /**
   * Проверяет валидность URL
   * @param url URL для проверки
   * @returns true если URL валиден
   */
  private isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Проверяет валидность Project ID
   * @param projectId Project ID для проверки
   * @returns true если Project ID валиден
   */
  private isValidProjectId(projectId: string): boolean {
    // Проверка на число
    if (/^\d+$/.test(projectId)) {
      return true;
    }

    // Проверка на путь вида group/project или group/subgroup/project
    // Разрешаем буквы, цифры, подчеркивания, дефисы и точки
    if (/^[a-zA-Z0-9_.\-]+([\/][a-zA-Z0-9_.\-]+)+$/.test(projectId)) {
      return true;
    }

    return false;
  }

  /**
   * Проверяет валидность токена
   * @param token Токен для проверки
   * @returns true если токен валиден
   */
  private isValidToken(token: string): boolean {
    // Новые токены GitLab начинаются с glpat-
    if (token.startsWith('glpat-')) {
      return token.length > 25; // glpat- + минимум 20 символов
    }

    // Старые токены - просто строка минимум 20 символов
    return token.length >= 20;
  }

  /**
   * Показывает диалог настройки GitLab
   * Запрашивает у пользователя все необходимые параметры
   */
  async showConfigurationDialog(): Promise<boolean> {
    // Запрос базового URL
    const baseUrl = await window.showInputBox({
      prompt: 'Enter GitLab Base URL',
      placeHolder: 'https://gitlab.com or https://gitlab-sonarqube-sti.phoenixit.ru',
      value: this.getBaseUrl() || '',
      validateInput: (value) => {
        if (!value || value.trim() === '') {
          return 'Base URL is required';
        }
        if (!this.isValidUrl(value)) {
          return 'Please enter a valid URL (http:// or https://)';
        }
        return null;
      },
    });

    if (!baseUrl) {
      return false; // Пользователь отменил
    }

    // Запрос Project ID
    const projectId = await window.showInputBox({
      prompt: 'Enter GitLab Project ID',
      placeHolder: '123 or group/project',
      value: this.getProjectId() || '',
      validateInput: (value) => {
        if (!value || value.trim() === '') {
          return 'Project ID is required';
        }
        if (!this.isValidProjectId(value)) {
          return 'Project ID must be a number or a path (e.g., "group/project")';
        }
        return null;
      },
    });

    if (!projectId) {
      return false; // Пользователь отменил
    }

    // Запрос токена
    const token = await window.showInputBox({
      prompt: 'Enter GitLab Personal Access Token',
      placeHolder: 'glpat-...',
      password: true,
      validateInput: (value) => {
        if (!value || value.trim() === '') {
          return 'Token is required';
        }
        if (!this.isValidToken(value)) {
          return 'Token should start with "glpat-" or be at least 20 characters';
        }
        return null;
      },
    });

    if (!token) {
      return false; // Пользователь отменил
    }

    // Сохранение настроек
    try {
      const config = workspace.getConfiguration('code-review.gitlab');
      await config.update('baseUrl', baseUrl.trim(), true);
      await config.update('projectId', projectId.trim(), true);
      await this.setToken(token);

      window.showInformationMessage('GitLab configuration saved successfully');
      return true;
    } catch (error) {
      window.showErrorMessage(`Failed to save GitLab configuration: ${error}`);
      return false;
    }
  }
}
