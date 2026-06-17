// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { expect, test } from '@jest/globals';
import { escapeUrlForRegex, removeLinkFromLine } from '../src/scan';

const linkLine =
  '\t\t\t\t\t"Description": "Added the [getDownloadUrl](https://learn.microsoft.com/en-us/graph/api/caseExportOperation-getDownloadUrl?view=graph-rest-beta) method to the [caseExportOperation](https://learn.microsoft.com/en-us/graph/api/resources/caseExportOperation?view=graph-rest-beta) resource.",\r';
const link =
  'https://learn.microsoft.com/en-us/graph/api/resources/caseExportOperation?view=graph-rest-beta';
const removedLinkLine =
  '\t\t\t\t\t"Description": "Added the [getDownloadUrl](https://learn.microsoft.com/en-us/graph/api/caseExportOperation-getDownloadUrl?view=graph-rest-beta) method to the **caseExportOperation** resource.",\r';

test('Link is removed from line correctly', () => {
  const modifiedLine = removeLinkFromLine(linkLine, link);
  expect(modifiedLine).toBe(removedLinkLine);
});

test('Removing the only link on a line replaces it with bold text', () => {
  const line =
    '"Description": "See the [API reference](https://example.com/api)."';
  const result = removeLinkFromLine(line, 'https://example.com/api');
  expect(result).toBe('"Description": "See the **API reference**."');
});

test('Removing all matching links leaves other links intact', () => {
  const line =
    '[keep](https://other.com) and [remove](https://example.com/gone)';
  const result = removeLinkFromLine(line, 'https://example.com/gone');
  expect(result).toBe('[keep](https://other.com) and **remove**');
});

test('escapeUrlForRegex escapes all dots and question marks', () => {
  const url = 'https://example.com/path.name?key=val&other=1';
  const escaped = escapeUrlForRegex(url);
  expect(escaped).toBe('https://example\\.com/path\\.name\\?key=val&other=1');
  // Verify no unescaped dots or question marks remain
  expect(escaped).not.toMatch(/(?<!\\)\./);
  expect(escaped).not.toMatch(/(?<!\\)\?/);
});

test('escapeUrlForRegex handles URL with multiple query params', () => {
  const url = 'https://learn.microsoft.com/api/test?view=beta&format=json';
  const escaped = escapeUrlForRegex(url);
  expect(escaped).toBe(
    'https://learn\\.microsoft\\.com/api/test\\?view=beta&format=json',
  );
});
