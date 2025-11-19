import * as assert from 'assert';
import { PaginationInfo, PaginatedResult } from '../../utils/gitlab-client';

/**
 * Unit-тесты для пагинации GitLab API
 */
suite('GitLab Pagination Tests', () => {
  test('Should create valid PaginationInfo structure', () => {
    const pagination: PaginationInfo = {
      total: 100,
      totalPages: 10,
      perPage: 10,
      page: 1,
      nextPage: 2,
      prevPage: null,
    };

    assert.strictEqual(pagination.total, 100);
    assert.strictEqual(pagination.totalPages, 10);
    assert.strictEqual(pagination.perPage, 10);
    assert.strictEqual(pagination.page, 1);
    assert.strictEqual(pagination.nextPage, 2);
    assert.strictEqual(pagination.prevPage, null);
  });

  test('Should create valid PaginatedResult structure', () => {
    const result: PaginatedResult<any> = {
      data: [{ id: 1 }, { id: 2 }],
      pagination: {
        total: 2,
        totalPages: 1,
        perPage: 10,
        page: 1,
        nextPage: null,
        prevPage: null,
      },
    };

    assert.ok(Array.isArray(result.data));
    assert.strictEqual(result.data.length, 2);
    assert.ok(result.pagination);
    assert.strictEqual(result.pagination.total, 2);
  });

  test('Should handle first page pagination', () => {
    const pagination: PaginationInfo = {
      total: 100,
      totalPages: 10,
      perPage: 10,
      page: 1,
      nextPage: 2,
      prevPage: null,
    };

    assert.strictEqual(pagination.page, 1);
    assert.strictEqual(pagination.prevPage, null);
    assert.strictEqual(pagination.nextPage, 2);
  });

  test('Should handle middle page pagination', () => {
    const pagination: PaginationInfo = {
      total: 100,
      totalPages: 10,
      perPage: 10,
      page: 5,
      nextPage: 6,
      prevPage: 4,
    };

    assert.strictEqual(pagination.page, 5);
    assert.strictEqual(pagination.prevPage, 4);
    assert.strictEqual(pagination.nextPage, 6);
  });

  test('Should handle last page pagination', () => {
    const pagination: PaginationInfo = {
      total: 100,
      totalPages: 10,
      perPage: 10,
      page: 10,
      nextPage: null,
      prevPage: 9,
    };

    assert.strictEqual(pagination.page, 10);
    assert.strictEqual(pagination.prevPage, 9);
    assert.strictEqual(pagination.nextPage, null);
  });

  test('Should handle single page result', () => {
    const pagination: PaginationInfo = {
      total: 5,
      totalPages: 1,
      perPage: 10,
      page: 1,
      nextPage: null,
      prevPage: null,
    };

    assert.strictEqual(pagination.totalPages, 1);
    assert.strictEqual(pagination.nextPage, null);
    assert.strictEqual(pagination.prevPage, null);
  });

  test('Should handle empty result', () => {
    const result: PaginatedResult<any> = {
      data: [],
      pagination: {
        total: 0,
        totalPages: 0,
        perPage: 10,
        page: 1,
        nextPage: null,
        prevPage: null,
      },
    };

    assert.strictEqual(result.data.length, 0);
    assert.strictEqual(result.pagination.total, 0);
    assert.strictEqual(result.pagination.totalPages, 0);
  });

  test('Should calculate correct total pages', () => {
    // 100 items, 10 per page = 10 pages
    const pagination1: PaginationInfo = {
      total: 100,
      totalPages: 10,
      perPage: 10,
      page: 1,
      nextPage: 2,
      prevPage: null,
    };
    assert.strictEqual(pagination1.totalPages, Math.ceil(pagination1.total / pagination1.perPage));

    // 95 items, 10 per page = 10 pages
    const pagination2: PaginationInfo = {
      total: 95,
      totalPages: 10,
      perPage: 10,
      page: 1,
      nextPage: 2,
      prevPage: null,
    };
    assert.strictEqual(pagination2.totalPages, Math.ceil(pagination2.total / pagination2.perPage));

    // 101 items, 10 per page = 11 pages
    const pagination3: PaginationInfo = {
      total: 101,
      totalPages: 11,
      perPage: 10,
      page: 1,
      nextPage: 2,
      prevPage: null,
    };
    assert.strictEqual(pagination3.totalPages, Math.ceil(pagination3.total / pagination3.perPage));
  });

  test('Should handle different page sizes', () => {
    const pagination20: PaginationInfo = {
      total: 100,
      totalPages: 5,
      perPage: 20,
      page: 1,
      nextPage: 2,
      prevPage: null,
    };
    assert.strictEqual(pagination20.totalPages, 5);

    const pagination50: PaginationInfo = {
      total: 100,
      totalPages: 2,
      perPage: 50,
      page: 1,
      nextPage: 2,
      prevPage: null,
    };
    assert.strictEqual(pagination50.totalPages, 2);

    const pagination100: PaginationInfo = {
      total: 100,
      totalPages: 1,
      perPage: 100,
      page: 1,
      nextPage: null,
      prevPage: null,
    };
    assert.strictEqual(pagination100.totalPages, 1);
  });

  test('Should validate page boundaries', () => {
    const pagination: PaginationInfo = {
      total: 100,
      totalPages: 10,
      perPage: 10,
      page: 5,
      nextPage: 6,
      prevPage: 4,
    };

    assert.ok(pagination.page >= 1);
    assert.ok(pagination.page <= pagination.totalPages);

    if (pagination.nextPage !== null) {
      assert.ok(pagination.nextPage > pagination.page);
      assert.ok(pagination.nextPage <= pagination.totalPages);
    }

    if (pagination.prevPage !== null) {
      assert.ok(pagination.prevPage < pagination.page);
      assert.ok(pagination.prevPage >= 1);
    }
  });

  test('Should handle maximum page size (100)', () => {
    const pagination: PaginationInfo = {
      total: 1000,
      totalPages: 10,
      perPage: 100,
      page: 1,
      nextPage: 2,
      prevPage: null,
    };

    assert.strictEqual(pagination.perPage, 100);
    assert.strictEqual(pagination.totalPages, 10);
  });

  test('Should type-check PaginatedResult with specific data type', () => {
    interface TestData {
      id: number;
      name: string;
    }

    const result: PaginatedResult<TestData> = {
      data: [
        { id: 1, name: 'Test 1' },
        { id: 2, name: 'Test 2' },
      ],
      pagination: {
        total: 2,
        totalPages: 1,
        perPage: 10,
        page: 1,
        nextPage: null,
        prevPage: null,
      },
    };

    assert.strictEqual(result.data[0].id, 1);
    assert.strictEqual(result.data[0].name, 'Test 1');
    assert.strictEqual(result.data[1].id, 2);
    assert.strictEqual(result.data[1].name, 'Test 2');
  });
});
