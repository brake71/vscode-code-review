import * as assert from 'assert';
import { GitLabApiError } from '../../utils/gitlab-client';

/**
 * Unit-тесты для обработки ошибок GitLab API
 */
suite('GitLab Error Handling Tests', () => {
  test('Should create GitLabApiError with basic parameters', () => {
    const error = new GitLabApiError('Test error', 400);

    assert.strictEqual(error.message, 'Test error');
    assert.strictEqual(error.statusCode, 400);
    assert.strictEqual(error.name, 'GitLabApiError');
  });

  test('Should create GitLabApiError with response data', () => {
    const response = { message: 'Validation failed', errors: ['Title is required'] };
    const error = new GitLabApiError('Test error', 422, response);

    assert.strictEqual(error.statusCode, 422);
    assert.deepStrictEqual(error.response, response);
  });

  test('Should create GitLabApiError with details', () => {
    const error = new GitLabApiError('Test error', 400, undefined, 'Additional details');

    assert.strictEqual(error.details, 'Additional details');
  });

  test('Should provide user-friendly message for 400 error', () => {
    const error = new GitLabApiError('Bad Request', 400);
    const userMessage = error.getUserMessage();

    assert.ok(userMessage.includes('Bad Request'));
    assert.ok(userMessage.includes('данных') || userMessage.includes('data'));
  });

  test('Should provide user-friendly message for 401 error', () => {
    const error = new GitLabApiError('Unauthorized', 401);
    const userMessage = error.getUserMessage();

    assert.ok(userMessage.includes('Unauthorized'));
    assert.ok(userMessage.includes('токен') || userMessage.includes('Token'));
  });

  test('Should provide user-friendly message for 403 error', () => {
    const error = new GitLabApiError('Forbidden', 403);
    const userMessage = error.getUserMessage();

    assert.ok(userMessage.includes('Forbidden'));
    assert.ok(userMessage.includes('прав') || userMessage.includes('permission'));
  });

  test('Should provide user-friendly message for 404 error', () => {
    const error = new GitLabApiError('Not Found', 404);
    const userMessage = error.getUserMessage();

    assert.ok(userMessage.includes('Not Found'));
    assert.ok(userMessage.includes('Project ID') || userMessage.includes('ресурс'));
  });

  test('Should provide user-friendly message for 422 error', () => {
    const error = new GitLabApiError('Validation Error', 422);
    const userMessage = error.getUserMessage();

    assert.ok(userMessage.includes('Validation'));
    assert.ok(userMessage.includes('валидац') || userMessage.includes('validation'));
  });

  test('Should provide user-friendly message for 429 error', () => {
    const error = new GitLabApiError('Rate Limit Exceeded', 429);
    const userMessage = error.getUserMessage();

    assert.ok(userMessage.includes('Rate Limit') || userMessage.includes('лимит'));
  });

  test('Should provide user-friendly message for 500 error', () => {
    const error = new GitLabApiError('Internal Server Error', 500);
    const userMessage = error.getUserMessage();

    assert.ok(userMessage.includes('Server Error') || userMessage.includes('сервер'));
  });

  test('Should include details in user message when provided', () => {
    const error = new GitLabApiError('Test error', 400, undefined, 'Field validation failed');
    const userMessage = error.getUserMessage();

    assert.ok(userMessage.includes('Field validation failed'));
  });

  test('Should handle unknown status codes', () => {
    const error = new GitLabApiError('Unknown error', 999);
    const userMessage = error.getUserMessage();

    assert.strictEqual(userMessage, 'Unknown error');
  });

  test('Should be instance of Error', () => {
    const error = new GitLabApiError('Test error', 400);

    assert.ok(error instanceof Error);
    assert.ok(error instanceof GitLabApiError);
  });

  test('Should have correct error name', () => {
    const error = new GitLabApiError('Test error', 400);

    assert.strictEqual(error.name, 'GitLabApiError');
  });

  test('Should preserve stack trace', () => {
    const error = new GitLabApiError('Test error', 400);

    assert.ok(error.stack);
    assert.ok(error.stack.includes('GitLabApiError'));
  });

  test('Should handle validation error with object message', () => {
    const response = {
      message: {
        title: ['is required', 'is too short'],
        description: ['is invalid'],
      },
    };
    const error = new GitLabApiError(
      'Validation failed',
      422,
      response,
      'title: is required, is too short; description: is invalid',
    );
    const userMessage = error.getUserMessage();

    assert.ok(userMessage.includes('title'));
    assert.ok(userMessage.includes('description'));
  });

  test('Should handle rate limit error with retry information', () => {
    const response = { retryAfter: 60 };
    const error = new GitLabApiError(
      'Rate Limit Exceeded',
      429,
      response,
      'Превышен лимит запросов к API. Повторите попытку через 60 секунд.',
    );
    const userMessage = error.getUserMessage();

    assert.ok(userMessage.includes('60'));
  });

  test('Should handle network error', () => {
    const error = new GitLabApiError(
      'Network error: ECONNREFUSED',
      0,
      undefined,
      'Ошибка сети. Проверьте подключение к серверу GitLab.',
    );
    const userMessage = error.getUserMessage();

    assert.ok(userMessage.includes('Network error') || userMessage.includes('сети'));
  });

  test('Should handle timeout error', () => {
    const error = new GitLabApiError(
      'Request timeout after 30000ms',
      0,
      undefined,
      'Превышено время ожидания ответа (30000ms). Проверьте доступность сервера.',
    );
    const userMessage = error.getUserMessage();

    assert.ok(userMessage.includes('timeout') || userMessage.includes('ожидания'));
  });
});
