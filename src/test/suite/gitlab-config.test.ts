import * as assert from 'assert';
import { ExtensionContext } from 'vscode';
import { GitLabConfigManager } from '../../utils/gitlab-config';

suite('GitLab Config Manager', () => {
  let mockContext: ExtensionContext;
  let configManager: GitLabConfigManager;
  let secretsStore: Map<string, string>;

  setup(() => {
    // Create a mock secrets store
    secretsStore = new Map<string, string>();

    // Create a mock ExtensionContext
    mockContext = {
      secrets: {
        get: async (key: string) => secretsStore.get(key),
        store: async (key: string, value: string) => {
          secretsStore.set(key, value);
        },
        delete: async (key: string) => {
          secretsStore.delete(key);
        },
      },
    } as any;

    configManager = new GitLabConfigManager(mockContext);
  });

  suite('Token Management', () => {
    test('should store and retrieve token', async () => {
      const testToken = 'TEST_TOKEN_12345678901234567890';
      await configManager.setToken(testToken);
      const retrievedToken = await configManager.getToken();
      assert.strictEqual(retrievedToken, testToken);
    });

    test('should trim token when storing', async () => {
      const testToken = '  TEST_TOKEN_12345678901234567890  ';
      await configManager.setToken(testToken);
      const retrievedToken = await configManager.getToken();
      assert.strictEqual(retrievedToken, testToken.trim());
    });

    test('should throw error when storing empty token', async () => {
      await assert.rejects(async () => await configManager.setToken(''), /Token cannot be empty/);
    });

    test('should delete token', async () => {
      const testToken = 'TEST_TOKEN_12345678901234567890';
      await configManager.setToken(testToken);
      await configManager.deleteToken();
      const retrievedToken = await configManager.getToken();
      assert.strictEqual(retrievedToken, undefined);
    });
  });

  suite('Configuration Validation', () => {
    test('should validate correct GitLab token format (glpat-)', () => {
      const manager = configManager as any;
      assert.strictEqual(manager.isValidToken('glpat-xxxx12345678901234567890'), true);
      assert.strictEqual(manager.isValidToken('glpat-abc'), false);
    });

    test('should validate legacy token format', () => {
      const manager = configManager as any;
      assert.strictEqual(manager.isValidToken('12345678901234567890'), true);
      assert.strictEqual(manager.isValidToken('short'), false);
    });

    test('should validate URL format', () => {
      const manager = configManager as any;
      assert.strictEqual(manager.isValidUrl('https://gitlab.com'), true);
      assert.strictEqual(manager.isValidUrl('http://gitlab.com'), true);
      assert.strictEqual(manager.isValidUrl('ftp://gitlab.com'), false);
      assert.strictEqual(manager.isValidUrl('not-a-url'), false);
    });

    test('should validate numeric project ID', () => {
      const manager = configManager as any;
      assert.strictEqual(manager.isValidProjectId('123'), true);
      assert.strictEqual(manager.isValidProjectId('456789'), true);
    });

    test('should validate path-based project ID', () => {
      const manager = configManager as any;
      assert.strictEqual(manager.isValidProjectId('group/project'), true);
      assert.strictEqual(manager.isValidProjectId('group/subgroup/project'), true);
      assert.strictEqual(manager.isValidProjectId('my-group/my-project'), true);
      assert.strictEqual(manager.isValidProjectId('my.group/my-project'), true);
    });

    test('should reject invalid project ID', () => {
      const manager = configManager as any;
      assert.strictEqual(manager.isValidProjectId(''), false);
      assert.strictEqual(manager.isValidProjectId('invalid project'), false);
      assert.strictEqual(manager.isValidProjectId('/leading/slash'), false);
    });
  });

  suite('Default Values', () => {
    test('should return default labels', () => {
      const labels = configManager.getDefaultLabels();
      assert.ok(Array.isArray(labels));
      assert.ok(labels.includes('code-review'));
    });
  });
});
