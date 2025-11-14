import * as assert from 'assert';
import { ProgressManager, CodeRabbitImportStats } from '../../utils/progress-manager';

suite('Progress Manager Test Suite', () => {
  suite('CodeRabbitImportStats Interface', () => {
    test('should create valid stats object', () => {
      const stats: CodeRabbitImportStats = {
        reviewsProcessed: 5,
        commentsImported: 20,
        commentsSkipped: 3,
        skippedNoFile: 1,
        skippedNoMessage: 1,
        skippedResolved: 1,
        skippedDuplicate: 0,
      };

      assert.strictEqual(stats.reviewsProcessed, 5);
      assert.strictEqual(stats.commentsImported, 20);
      assert.strictEqual(stats.commentsSkipped, 3);
      assert.strictEqual(stats.skippedNoFile, 1);
      assert.strictEqual(stats.skippedNoMessage, 1);
      assert.strictEqual(stats.skippedResolved, 1);
      assert.strictEqual(stats.skippedDuplicate, 0);
    });

    test('should handle zero values', () => {
      const stats: CodeRabbitImportStats = {
        reviewsProcessed: 0,
        commentsImported: 0,
        commentsSkipped: 0,
        skippedNoFile: 0,
        skippedNoMessage: 0,
        skippedResolved: 0,
        skippedDuplicate: 0,
      };

      assert.strictEqual(stats.reviewsProcessed, 0);
      assert.strictEqual(stats.commentsImported, 0);
    });
  });

  suite('ProgressManager.log', () => {
    test('should log message without throwing error', () => {
      assert.doesNotThrow(() => {
        ProgressManager.log('Test log message');
      });
    });

    test('should handle empty message', () => {
      assert.doesNotThrow(() => {
        ProgressManager.log('');
      });
    });

    test('should handle multiline message', () => {
      assert.doesNotThrow(() => {
        ProgressManager.log('Line 1\nLine 2\nLine 3');
      });
    });

    test('should handle special characters', () => {
      assert.doesNotThrow(() => {
        ProgressManager.log('Special chars: !@#$%^&*()_+-={}[]|\\:";\'<>?,./');
      });
    });
  });

  suite('ProgressManager.showImportResults', () => {
    test('should handle successful import with comments', () => {
      const stats: CodeRabbitImportStats = {
        reviewsProcessed: 3,
        commentsImported: 15,
        commentsSkipped: 2,
        skippedNoFile: 1,
        skippedNoMessage: 1,
        skippedResolved: 0,
        skippedDuplicate: 0,
      };

      assert.doesNotThrow(() => {
        ProgressManager.showImportResults(stats);
      });
    });

    test('should handle import with no new comments', () => {
      const stats: CodeRabbitImportStats = {
        reviewsProcessed: 2,
        commentsImported: 0,
        commentsSkipped: 5,
        skippedNoFile: 2,
        skippedNoMessage: 1,
        skippedResolved: 2,
        skippedDuplicate: 0,
      };

      assert.doesNotThrow(() => {
        ProgressManager.showImportResults(stats);
      });
    });

    test('should handle import with no reviews found', () => {
      const stats: CodeRabbitImportStats = {
        reviewsProcessed: 0,
        commentsImported: 0,
        commentsSkipped: 0,
        skippedNoFile: 0,
        skippedNoMessage: 0,
        skippedResolved: 0,
        skippedDuplicate: 0,
      };

      assert.doesNotThrow(() => {
        ProgressManager.showImportResults(stats);
      });
    });

    test('should handle import with duplicates', () => {
      const stats: CodeRabbitImportStats = {
        reviewsProcessed: 5,
        commentsImported: 10,
        commentsSkipped: 8,
        skippedNoFile: 0,
        skippedNoMessage: 0,
        skippedResolved: 0,
        skippedDuplicate: 8,
      };

      assert.doesNotThrow(() => {
        ProgressManager.showImportResults(stats);
      });
    });

    test('should handle large numbers', () => {
      const stats: CodeRabbitImportStats = {
        reviewsProcessed: 1000,
        commentsImported: 5000,
        commentsSkipped: 500,
        skippedNoFile: 100,
        skippedNoMessage: 100,
        skippedResolved: 200,
        skippedDuplicate: 100,
      };

      assert.doesNotThrow(() => {
        ProgressManager.showImportResults(stats);
      });
    });
  });

  suite('ProgressManager.showError', () => {
    test('should handle error message without error object', () => {
      assert.doesNotThrow(() => {
        ProgressManager.showError('Test error message');
      });
    });

    test('should handle error message with error object', () => {
      const error = new Error('Test error');
      assert.doesNotThrow(() => {
        ProgressManager.showError('An error occurred', error);
      });
    });

    test('should handle error with stack trace', () => {
      const error = new Error('Test error with stack');
      error.stack = 'Error: Test error\n    at test.ts:10:5';

      assert.doesNotThrow(() => {
        ProgressManager.showError('Error with stack', error);
      });
    });

    test('should handle empty error message', () => {
      assert.doesNotThrow(() => {
        ProgressManager.showError('');
      });
    });
  });

  suite('ProgressManager.withProgress', () => {
    test('should execute task and return result', async () => {
      const result = await ProgressManager.withProgress('Test Progress', async (progress) => {
        return 'test result';
      });

      assert.strictEqual(result, 'test result');
    });

    test('should handle task that throws error', async () => {
      try {
        await ProgressManager.withProgress('Test Progress', async (progress) => {
          throw new Error('Test error');
        });
        assert.fail('Should have thrown error');
      } catch (error: any) {
        assert.strictEqual(error.message, 'Test error');
      }
    });

    test('should handle async task with delay', async () => {
      const startTime = Date.now();
      const result = await ProgressManager.withProgress('Test Progress', async (progress) => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return 'delayed result';
      });
      const endTime = Date.now();

      assert.strictEqual(result, 'delayed result');
      assert.ok(endTime - startTime >= 100, 'Task should take at least 100ms');
    });

    test('should handle task with progress updates', async () => {
      const result = await ProgressManager.withProgress('Test Progress', async (progress) => {
        progress.report({ message: 'Step 1' });
        await new Promise((resolve) => setTimeout(resolve, 10));
        progress.report({ message: 'Step 2', increment: 50 });
        await new Promise((resolve) => setTimeout(resolve, 10));
        progress.report({ message: 'Step 3', increment: 50 });
        return 'completed';
      });

      assert.strictEqual(result, 'completed');
    });

    test('should handle task that returns object', async () => {
      const result = await ProgressManager.withProgress('Test Progress', async (progress) => {
        return { success: true, count: 42 };
      });

      assert.deepStrictEqual(result, { success: true, count: 42 });
    });

    test('should handle task that returns array', async () => {
      const result = await ProgressManager.withProgress('Test Progress', async (progress) => {
        return [1, 2, 3, 4, 5];
      });

      assert.deepStrictEqual(result, [1, 2, 3, 4, 5]);
    });
  });

  suite('ProgressManager.dispose', () => {
    test('should dispose without throwing error', () => {
      assert.doesNotThrow(() => {
        ProgressManager.dispose();
      });
    });

    test('should allow multiple dispose calls', () => {
      assert.doesNotThrow(() => {
        ProgressManager.dispose();
        ProgressManager.dispose();
        ProgressManager.dispose();
      });
    });

    test('should allow logging after dispose', () => {
      ProgressManager.dispose();
      assert.doesNotThrow(() => {
        ProgressManager.log('Test after dispose');
      });
    });
  });
});
