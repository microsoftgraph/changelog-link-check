// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { jest, expect, test, describe, beforeEach } from '@jest/globals';

// Mock node-fetch before importing validation module
const mockFetch = jest.fn<(url: string) => Promise<{ ok: boolean }>>();
jest.unstable_mockModule('node-fetch', () => ({
  __esModule: true,
  default: mockFetch,
  FetchError: class FetchError extends Error {
    code: string;
    constructor(
      message: string,
      _type: string,
      systemError?: { code: string },
    ) {
      super(message);
      this.name = 'FetchError';
      this.code = systemError?.code ?? '';
    }
  },
}));

// Import validation after mocking
const {
  isUrlInvalid,
  getInvalidLinks,
  isLineInvalid,
  checkFilesForBrokenLinks,
  getListOfNewUrls,
} = await import('../src/validation');

const { FetchError } = await import('node-fetch');

describe('isUrlInvalid with mocked fetch', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  test('undefined url is invalid', async () => {
    expect(await isUrlInvalid([], undefined)).toBe(true);
  });

  test('malformed url (not parseable) is invalid', async () => {
    expect(await isUrlInvalid([], 'not-a-url')).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test('valid url that returns 200 passes', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    expect(await isUrlInvalid([], 'https://example.com/good')).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test('url that returns non-ok and is in newUrls passes', async () => {
    mockFetch.mockResolvedValue({ ok: false });
    expect(
      await isUrlInvalid(
        ['https://example.com/new-page'],
        'https://example.com/new-page',
      ),
    ).toBe(false);
  });

  test('url that returns non-ok and is NOT in newUrls fails', async () => {
    mockFetch.mockResolvedValue({ ok: false });
    expect(await isUrlInvalid([], 'https://example.com/missing')).toBe(true);
  });

  test('ETIMEDOUT retries once and succeeds', async () => {
    const timeoutError = new FetchError('timeout', 'system', {
      code: 'ETIMEDOUT',
    });
    mockFetch
      .mockRejectedValueOnce(timeoutError)
      .mockResolvedValueOnce({ ok: true });
    expect(await isUrlInvalid([], 'https://example.com/slow')).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  test('ETIMEDOUT retries once and fails', async () => {
    const timeoutError = new FetchError('timeout', 'system', {
      code: 'ETIMEDOUT',
    });
    mockFetch
      .mockRejectedValueOnce(timeoutError)
      .mockRejectedValueOnce(new Error('still failing'));
    expect(await isUrlInvalid([], 'https://example.com/dead')).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  test('non-timeout fetch error is immediately invalid', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));
    expect(await isUrlInvalid([], 'https://example.com/refused')).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe('getInvalidLinks with mocked fetch', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  test('line with no links returns empty array', async () => {
    const result = await getInvalidLinks('no links here', []);
    expect(result).toEqual([]);
  });

  test('line with one valid link returns empty array', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    const line = 'See [docs](https://example.com/valid)';
    const result = await getInvalidLinks(line, []);
    expect(result).toEqual([]);
  });

  test('line with one broken link returns that link', async () => {
    mockFetch.mockResolvedValue({ ok: false });
    const line = 'See [docs](https://example.com/broken)';
    const result = await getInvalidLinks(line, []);
    expect(result).toEqual(['https://example.com/broken']);
  });

  test('line with mix of valid and broken links returns only broken', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false });
    const line =
      '[good](https://example.com/a) and [bad](https://example.com/b)';
    const result = await getInvalidLinks(line, []);
    expect(result).toEqual(['https://example.com/b']);
  });
});

describe('isLineInvalid with mocked fetch', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  test('line with no links is not invalid', async () => {
    expect(await isLineInvalid('just text', [])).toBe(false);
  });

  test('line with all valid links is not invalid', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    const line =
      '[a](https://example.com/a) and [b](https://example.com/b-line)';
    expect(await isLineInvalid(line, [])).toBe(false);
  });

  test('line with one broken link among valid ones is invalid', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false });
    const line =
      '[good](https://example.com/ok) and [bad](https://example.com/nope)';
    expect(await isLineInvalid(line, [])).toBe(true);
  });
});

describe('checkFilesForBrokenLinks with mocked fetch', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  test('returns only files with broken links when given a mix', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/INVALID/')) {
        return Promise.resolve({ ok: false });
      }
      return Promise.resolve({ ok: true });
    });

    const files = [
      {
        sha: '',
        filename: 'test/data/good-change-log.json',
        status: 'modified' as const,
        additions: 0,
        deletions: 0,
        changes: 0,
        blob_url: '',
        raw_url: '',
        contents_url: '',
      },
      {
        sha: '',
        filename: 'test/data/bad-change-log.json',
        status: 'modified' as const,
        additions: 0,
        deletions: 0,
        changes: 0,
        blob_url: '',
        raw_url: '',
        contents_url: '',
      },
    ];

    const result = await checkFilesForBrokenLinks(files, 'test/data');

    expect(result).toHaveLength(1);
    expect(result[0].fileName).toBe('test/data/bad-change-log.json');
    expect(result[0].brokenLinks.length).toBeGreaterThan(0);
  });

  test('returns empty array when all files are valid', async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const files = [
      {
        sha: '',
        filename: 'test/data/good-change-log.json',
        status: 'modified' as const,
        additions: 0,
        deletions: 0,
        changes: 0,
        blob_url: '',
        raw_url: '',
        contents_url: '',
      },
    ];

    const result = await checkFilesForBrokenLinks(files, 'test/data');
    expect(result).toHaveLength(0);
  });
});

describe('getListOfNewUrls edge cases', () => {
  test('returns empty array when no files are added', () => {
    const files = [
      {
        sha: '',
        filename: 'api-reference/beta/api/user-list.md',
        status: 'modified' as const,
        additions: 0,
        deletions: 0,
        changes: 0,
        blob_url: '',
        raw_url: '',
        contents_url: '',
      },
    ];

    expect(getListOfNewUrls(files)).toEqual([]);
  });

  test('returns empty array for empty file list', () => {
    expect(getListOfNewUrls([])).toEqual([]);
  });

  test('skips added files with unrecognized paths', () => {
    const files = [
      {
        sha: '',
        filename: 'other-directory/some-file.md',
        status: 'added' as const,
        additions: 0,
        deletions: 0,
        changes: 0,
        blob_url: '',
        raw_url: '',
        contents_url: '',
      },
    ];

    expect(getListOfNewUrls(files)).toEqual([]);
  });
});
