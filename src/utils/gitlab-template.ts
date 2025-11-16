import { ExtensionContext } from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as handlebars from 'handlebars';
import { decode } from 'js-base64';
import { CsvEntry } from '../model';
import { GitLabConfigManager } from './gitlab-config';

/**
 * Движок для рендеринга шаблонов задач GitLab
 * Использует Handlebars для генерации описаний задач из комментариев
 */
export class TemplateEngine {
  private static readonly defaultTemplateName = 'template-gitlab-issue.default.hbs';

  constructor(private context: ExtensionContext, private configManager: GitLabConfigManager) {
    this.registerHelpers();
  }

  /**
   * Рендерит описание задачи GitLab из комментария
   * @param comment Комментарий для рендеринга
   * @returns Отрендеренное описание задачи в формате Markdown
   */
  renderIssueDescription(comment: CsvEntry): string {
    try {
      const templateContent = this.getTemplate();
      const templateCompiled = handlebars.compile(templateContent);
      return templateCompiled(comment);
    } catch (error) {
      throw new Error(`Failed to render issue description: ${error}`);
    }
  }

  /**
   * Получает шаблон (пользовательский или встроенный)
   * @returns Содержимое шаблона
   */
  private getTemplate(): string {
    // Попытка загрузить пользовательский шаблон
    const customTemplatePath = this.configManager.getIssueTemplatePath();
    if (customTemplatePath) {
      try {
        const templateContent = fs.readFileSync(customTemplatePath, 'utf8');
        return templateContent;
      } catch (error) {
        console.warn(`Failed to load custom template from ${customTemplatePath}, falling back to default: ${error}`);
      }
    }

    // Fallback на встроенный шаблон
    return this.getDefaultTemplate();
  }

  /**
   * Получает встроенный шаблон по умолчанию
   * @returns Содержимое встроенного шаблона
   */
  private getDefaultTemplate(): string {
    try {
      // В production (dist/) шаблон находится рядом с extension.js
      const distTemplatePath = path.join(this.context.extensionPath, 'dist', TemplateEngine.defaultTemplateName);
      if (fs.existsSync(distTemplatePath)) {
        return fs.readFileSync(distTemplatePath, 'utf8');
      }

      // В development (src/) шаблон находится в src/
      const srcTemplatePath = path.join(this.context.extensionPath, 'src', TemplateEngine.defaultTemplateName);
      if (fs.existsSync(srcTemplatePath)) {
        return fs.readFileSync(srcTemplatePath, 'utf8');
      }

      throw new Error(`Default template not found at ${distTemplatePath} or ${srcTemplatePath}`);
    } catch (error) {
      throw new Error(`Failed to load default template: ${error}`);
    }
  }

  /**
   * Регистрирует Handlebars хелперы
   */
  private registerHelpers(): void {
    // Хелпер для декодирования Base64 кода
    handlebars.registerHelper('codeBlock', (code: string) => {
      if (!code) {
        return '';
      }
      try {
        return decode(code);
      } catch (error) {
        console.warn(`Failed to decode code block: ${error}`);
        return code; // Возвращаем как есть, если декодирование не удалось
      }
    });

    // Хелпер для отображения приоритета
    handlebars.registerHelper('priorityName', (priority: number) => {
      switch (priority) {
        case 0:
          return 'Не указан';
        case 1:
          return 'Низкий';
        case 2:
          return 'Средний';
        case 3:
          return 'Высокий';
        default:
          return `Приоритет ${priority}`;
      }
    });
  }
}
