import * as assert from 'assert';
import { GitLabClient, GitLabApiError, CreateIssueParams, UpdateIssueParams } from '../../utils/gitlab-client';

/**
 * Тесты для GitLab API клиента
 *
 * ВАЖНО: Эти тесты требуют реального подключения к GitLab API
 * Для запуска тестов необходимо настроить переменные окружения:
 * - GITLAB_BASE_URL: URL GitLab сервера
 * - GITLAB_TOKEN: Personal Access Token
 * - GITLAB_PROJECT_ID: ID тестового проекта
 */
suite('GitLab API Client Tests', () => {
  let client: GitLabClient;
  let testIssueIid: string;

  const baseUrl = process.env.GITLAB_BASE_URL || 'https://gitlab.com';
  const token = process.env.GITLAB_TOKEN || '';
  const projectId = process.env.GITLAB_PROJECT_ID || '';

  // Пропускаем тесты если не настроены переменные окружения
  const skipTests = !token || !projectId;

  suiteSetup(() => {
    if (!skipTests) {
      client = new GitLabClient(baseUrl, token, projectId);
    }
  });

  test('Should create GitLab client instance', () => {
    if (skipTests) {
      console.log('Skipping test: GitLab credentials not configured');
      return;
    }

    assert.ok(client);
  });

  test('Should test connection successfully', async function () {
    if (skipTests) {
      this.skip();
      return;
    }

    const result = await client.testConnection();
    assert.strictEqual(result, true, 'Connection test should succeed');
  });

  test('Should create a new issue', async function () {
    if (skipTests) {
      this.skip();
      return;
    }

    this.timeout(10000); // Увеличиваем таймаут для API запроса

    const params: CreateIssueParams = {
      title: `[TEST] Issue created by automated test - ${new Date().toISOString()}`,
      description: 'This is a test issue created by automated tests.\n\nIt should be deleted after test completion.',
      labels: ['test', 'automated'],
    };

    const issue = await client.createIssue(params);

    assert.ok(issue);
    assert.ok(issue.id);
    assert.ok(issue.iid);
    assert.strictEqual(issue.title, params.title);
    assert.strictEqual(issue.description, params.description);
    assert.ok(issue.labels.includes('test'));
    assert.ok(issue.labels.includes('automated'));
    assert.strictEqual(issue.state, 'opened');

    // Сохраняем IID для последующих тестов
    testIssueIid = issue.iid.toString();
  });

  test('Should get an existing issue', async function () {
    if (skipTests || !testIssueIid) {
      this.skip();
      return;
    }

    this.timeout(10000);

    const issue = await client.getIssue(testIssueIid);

    assert.ok(issue);
    assert.strictEqual(issue.iid.toString(), testIssueIid);
    assert.ok(issue.title);
    assert.ok(issue.web_url);
  });

  test('Should return null for non-existent issue', async function () {
    if (skipTests) {
      this.skip();
      return;
    }

    this.timeout(10000);

    const issue = await client.getIssue('999999999');

    assert.strictEqual(issue, null);
  });

  test('Should get multiple issues by IIDs', async function () {
    if (skipTests || !testIssueIid) {
      this.skip();
      return;
    }

    this.timeout(10000);

    const issues = await client.getIssues([testIssueIid]);

    assert.ok(Array.isArray(issues));
    assert.strictEqual(issues.length, 1);
    assert.strictEqual(issues[0].iid.toString(), testIssueIid);
  });

  test('Should update an existing issue', async function () {
    if (skipTests || !testIssueIid) {
      this.skip();
      return;
    }

    this.timeout(10000);

    const newTitle = `[TEST] Updated issue - ${new Date().toISOString()}`;
    const params: UpdateIssueParams = {
      title: newTitle,
      add_labels: ['updated'],
    };

    const issue = await client.updateIssue(testIssueIid, params);

    assert.ok(issue);
    assert.strictEqual(issue.title, newTitle);
    assert.ok(issue.labels.includes('updated'));
  });

  test('Should close an issue', async function () {
    if (skipTests || !testIssueIid) {
      this.skip();
      return;
    }

    this.timeout(10000);

    const params: UpdateIssueParams = {
      state_event: 'close',
    };

    const issue = await client.updateIssue(testIssueIid, params);

    assert.ok(issue);
    assert.strictEqual(issue.state, 'closed');
  });

  test('Should reopen a closed issue', async function () {
    if (skipTests || !testIssueIid) {
      this.skip();
      return;
    }

    this.timeout(10000);

    const params: UpdateIssueParams = {
      state_event: 'reopen',
    };

    const issue = await client.updateIssue(testIssueIid, params);

    assert.ok(issue);
    assert.strictEqual(issue.state, 'opened');
  });

  test('Should create a note on an issue', async function () {
    if (skipTests || !testIssueIid) {
      this.skip();
      return;
    }

    this.timeout(10000);

    const note = await client.createNote(testIssueIid, {
      body: 'This is a test comment created by automated tests.',
    });

    assert.ok(note);
    assert.ok(note.id);
    assert.strictEqual(note.body, 'This is a test comment created by automated tests.');
    assert.strictEqual(note.system, false);
  });

  test('Should get notes from an issue', async function () {
    if (skipTests || !testIssueIid) {
      this.skip();
      return;
    }

    this.timeout(10000);

    const result = await client.getNotes(testIssueIid);

    assert.ok(result);
    assert.ok(Array.isArray(result.data));
    assert.ok(result.data.length > 0);
    assert.ok(result.pagination);
    assert.ok(result.pagination.total >= 1);
  });

  test('Should update a note', async function () {
    if (skipTests || !testIssueIid) {
      this.skip();
      return;
    }

    this.timeout(10000);

    // Сначала получаем список комментариев
    const notesResult = await client.getNotes(testIssueIid);
    const notes = notesResult.data.filter((note) => !note.system);

    if (notes.length === 0) {
      this.skip();
      return;
    }

    const noteId = notes[0].id;
    const updatedBody = 'This comment has been updated by automated tests.';

    const updatedNote = await client.updateNote(testIssueIid, noteId, {
      body: updatedBody,
    });

    assert.ok(updatedNote);
    assert.strictEqual(updatedNote.id, noteId);
    assert.strictEqual(updatedNote.body, updatedBody);
  });

  test('Should delete a note', async function () {
    if (skipTests || !testIssueIid) {
      this.skip();
      return;
    }

    this.timeout(10000);

    // Сначала получаем список комментариев
    const notesResult = await client.getNotes(testIssueIid);
    const notes = notesResult.data.filter((note) => !note.system);

    if (notes.length === 0) {
      this.skip();
      return;
    }

    const noteId = notes[0].id;

    // Удаляем комментарий
    await client.deleteNote(testIssueIid, noteId);

    // Проверяем, что комментарий удален
    const updatedNotesResult = await client.getNotes(testIssueIid);
    const deletedNote = updatedNotesResult.data.find((note) => note.id === noteId);

    assert.strictEqual(deletedNote, undefined);
  });

  test('Should delete the test issue', async function () {
    if (skipTests || !testIssueIid) {
      this.skip();
      return;
    }

    this.timeout(10000);

    const deletedIssue = await client.deleteIssue(testIssueIid);

    assert.ok(deletedIssue);
    assert.strictEqual(deletedIssue.iid.toString(), testIssueIid);
  });

  test('Should handle 404 error correctly', async function () {
    if (skipTests) {
      this.skip();
      return;
    }

    this.timeout(10000);

    try {
      await client.updateIssue('999999999', { title: 'Test' });
      assert.fail('Should have thrown an error');
    } catch (error) {
      assert.ok(error instanceof GitLabApiError);
      assert.strictEqual((error as GitLabApiError).statusCode, 404);
    }
  });

  test('Should handle validation error correctly', async function () {
    if (skipTests) {
      this.skip();
      return;
    }

    this.timeout(10000);

    try {
      await client.createIssue({ title: '' }); // Empty title should fail validation
      assert.fail('Should have thrown an error');
    } catch (error) {
      assert.ok(error instanceof GitLabApiError);
      assert.ok((error as GitLabApiError).statusCode === 400 || (error as GitLabApiError).statusCode === 422);
    }
  });

  test('Should handle unauthorized error correctly', async function () {
    this.timeout(10000);

    const invalidClient = new GitLabClient(baseUrl, 'invalid-token', projectId);

    try {
      await invalidClient.testConnection();
      assert.fail('Should have thrown an error');
    } catch (error) {
      assert.ok(error instanceof GitLabApiError);
      assert.strictEqual((error as GitLabApiError).statusCode, 401);
    }
  });

  test('Should provide user-friendly error messages', async function () {
    this.timeout(10000);

    const invalidClient = new GitLabClient(baseUrl, 'invalid-token', projectId);

    try {
      await invalidClient.testConnection();
      assert.fail('Should have thrown an error');
    } catch (error) {
      assert.ok(error instanceof GitLabApiError);
      const userMessage = (error as GitLabApiError).getUserMessage();
      assert.ok(userMessage.includes('токен') || userMessage.includes('Token'));
    }
  });

  test('Should handle pagination correctly', async function () {
    if (skipTests) {
      this.skip();
      return;
    }

    this.timeout(10000);

    // Создаем тестовую задачу для получения комментариев
    const issue = await client.createIssue({
      title: `[TEST] Pagination test - ${new Date().toISOString()}`,
      description: 'Test issue for pagination',
    });

    const issueIid = issue.iid.toString();

    try {
      // Создаем несколько комментариев
      for (let i = 0; i < 5; i++) {
        await client.createNote(issueIid, {
          body: `Test comment ${i + 1}`,
        });
      }

      // Получаем комментарии с пагинацией
      const result = await client.getNotes(issueIid, 1, 2);

      assert.ok(result);
      assert.ok(result.data);
      assert.ok(result.pagination);
      assert.ok(result.pagination.total >= 5);
      assert.strictEqual(result.pagination.perPage, 2);
      assert.strictEqual(result.pagination.page, 1);

      if (result.pagination.totalPages > 1) {
        assert.ok(result.pagination.nextPage);
      }
    } finally {
      // Очистка: удаляем тестовую задачу
      await client.deleteIssue(issueIid);
    }
  });
});
