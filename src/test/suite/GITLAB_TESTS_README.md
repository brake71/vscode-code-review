# GitLab API Tests

Этот каталог содержит тесты для проверки корректности работы с GitLab API.

## Типы тестов

### 1. Unit-тесты (не требуют подключения к GitLab)

- **gitlab-error-handling.test.ts** - Тесты обработки ошибок GitLab API
- **gitlab-pagination.test.ts** - Тесты структур пагинации
- **gitlab-config.test.ts** - Тесты конфигурации GitLab (существующий)
- **gitlab-template.test.ts** - Тесты шаблонов задач (существующий)

Эти тесты можно запускать без настройки подключения к GitLab.

### 2. Интеграционные тесты (требуют подключения к GitLab)

- **gitlab-client-api.test.ts** - Полные тесты GitLab API клиента
- **gitlab-client-errors.test.ts** - Тесты обработки ошибок API (существующий)

Эти тесты требуют реального подключения к GitLab API.

## Запуск тестов

### Запуск всех тестов

```bash
npm test
```

### Запуск только unit-тестов

```bash
npm run test -- --grep "Error Handling|Pagination"
```

### Запуск интеграционных тестов

Для запуска интеграционных тестов необходимо настроить переменные окружения:

```bash
# Windows (PowerShell)
$env:GITLAB_BASE_URL="https://gitlab-sonarqube-sti.phoenixit.ru"
$env:GITLAB_TOKEN="glpat-your-token-here"
$env:GITLAB_PROJECT_ID="123"
npm test

# Linux/macOS
export GITLAB_BASE_URL="https://gitlab-sonarqube-sti.phoenixit.ru"
export GITLAB_TOKEN="glpat-your-token-here"
export GITLAB_PROJECT_ID="123"
npm test
```

**ВАЖНО:** Используйте тестовый проект для интеграционных тестов, так как они создают и удаляют задачи.

## Настройка тестового окружения

### 1. Создание тестового проекта в GitLab

1. Создайте новый проект в GitLab (например, "code-review-tests")
2. Получите Project ID из настроек проекта
3. Создайте Personal Access Token с правами `api`

### 2. Настройка переменных окружения

Создайте файл `.env` в корне проекта (не коммитьте его в Git!):

```env
GITLAB_BASE_URL=https://gitlab-sonarqube-sti.phoenixit.ru
GITLAB_TOKEN=glpat-your-token-here
GITLAB_PROJECT_ID=123
```

### 3. Настройка VS Code для запуска тестов

Добавьте в `.vscode/launch.json`:

```json
{
  "type": "extensionHost",
  "request": "launch",
  "name": "Extension Tests with GitLab",
  "runtimeExecutable": "${execPath}",
  "args": [
    "--extensionDevelopmentPath=${workspaceFolder}",
    "--extensionTestsPath=${workspaceFolder}/out/test/suite/index"
  ],
  "env": {
    "GITLAB_BASE_URL": "https://gitlab-sonarqube-sti.phoenixit.ru",
    "GITLAB_TOKEN": "glpat-your-token-here",
    "GITLAB_PROJECT_ID": "123"
  },
  "outFiles": [
    "${workspaceFolder}/out/test/**/*.js"
  ],
  "preLaunchTask": "npm: watch"
}
```

## Покрытие тестами

### GitLab API Client (gitlab-client.ts)

- ✅ Создание задачи (`createIssue`)
- ✅ Получение задачи (`getIssue`)
- ✅ Получение нескольких задач (`getIssues`)
- ✅ Обновление задачи (`updateIssue`)
- ✅ Удаление задачи (`deleteIssue`)
- ✅ Получение комментариев (`getNotes`)
- ✅ Создание комментария (`createNote`)
- ✅ Обновление комментария (`updateNote`)
- ✅ Удаление комментария (`deleteNote`)
- ✅ Проверка подключения (`testConnection`)
- ✅ Обработка ошибок (400, 401, 403, 404, 422, 429, 500)
- ✅ Пагинация
- ✅ Retry механизм для 429 ошибок

### Error Handling (GitLabApiError)

- ✅ Создание ошибок с различными параметрами
- ✅ Генерация пользовательских сообщений
- ✅ Обработка различных HTTP статусов
- ✅ Форматирование ошибок валидации
- ✅ Обработка сетевых ошибок
- ✅ Обработка таймаутов

### Pagination

- ✅ Структура PaginationInfo
- ✅ Структура PaginatedResult
- ✅ Первая страница
- ✅ Средняя страница
- ✅ Последняя страница
- ✅ Одна страница
- ✅ Пустой результат
- ✅ Различные размеры страниц
- ✅ Максимальный размер страницы (100)

## Известные ограничения

1. **Rate Limiting**: GitLab API имеет ограничения на количество запросов (обычно 600 в минуту). При запуске большого количества тестов может возникнуть ошибка 429.

2. **Тестовые данные**: Интеграционные тесты создают реальные задачи и комментарии в GitLab. Используйте отдельный тестовый проект.

3. **Асинхронность**: Некоторые операции в GitLab могут выполняться асинхронно. Тесты учитывают это с помощью увеличенных таймаутов.

4. **Права доступа**: Токен должен иметь права `api` или `write_api` для выполнения всех операций.

## Отладка тестов

### Включение подробного логирования

Добавьте в начало теста:

```typescript
console.log('Test started:', new Date().toISOString());
```

### Проверка ответов API

Используйте `console.log` для вывода ответов:

```typescript
const issue = await client.getIssue(testIssueIid);
console.log('Issue:', JSON.stringify(issue, null, 2));
```

### Пропуск тестов

Если тест не проходит, можно временно пропустить его:

```typescript
test.skip('Should do something', async function () {
  // Test code
});
```

## Добавление новых тестов

При добавлении новых методов в GitLab API клиент:

1. Добавьте unit-тесты для проверки структуры данных
2. Добавьте интеграционные тесты для проверки реальных API запросов
3. Добавьте тесты обработки ошибок
4. Обновите документацию покрытия тестами

## Continuous Integration

Для CI/CD рекомендуется:

1. Использовать отдельный тестовый проект GitLab
2. Хранить токен в секретах CI/CD
3. Запускать только unit-тесты в pull requests
4. Запускать полные интеграционные тесты только в main ветке

Пример для GitHub Actions:

```yaml
- name: Run unit tests
  run: npm run test -- --grep "Error Handling|Pagination"

- name: Run integration tests
  if: github.ref == 'refs/heads/main'
  env:
    GITLAB_BASE_URL: ${{ secrets.GITLAB_BASE_URL }}
    GITLAB_TOKEN: ${{ secrets.GITLAB_TOKEN }}
    GITLAB_PROJECT_ID: ${{ secrets.GITLAB_PROJECT_ID }}
  run: npm test
```

## Поддержка

При возникновении проблем с тестами:

1. Проверьте правильность настройки переменных окружения
2. Убедитесь, что токен имеет необходимые права
3. Проверьте доступность GitLab сервера
4. Проверьте логи тестов для детальной информации об ошибках
