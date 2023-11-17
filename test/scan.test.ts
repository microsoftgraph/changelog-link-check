import { expect, test } from '@jest/globals';
import { removeLinkFromLine } from '../src/scan';

const linkLine = '\t\t\t\t\t"Description": "Added the [getDownloadUrl](https://learn.microsoft.com/en-us/graph/api/caseExportOperation-getDownloadUrl?view=graph-rest-beta) method to the [caseExportOperation](https://learn.microsoft.com/en-us/graph/api/resources/caseExportOperation?view=graph-rest-beta) resource.",\r';
const link = 'https://learn.microsoft.com/en-us/graph/api/resources/caseExportOperation?view=graph-rest-beta';
const removedLinkLine = '\t\t\t\t\t"Description": "Added the [getDownloadUrl](https://learn.microsoft.com/en-us/graph/api/caseExportOperation-getDownloadUrl?view=graph-rest-beta) method to the **caseExportOperation** resource.",\r';

test('Link is removed from line correctly', () => {
  const modifiedLine = removeLinkFromLine(linkLine, link);
  expect(modifiedLine).toBe(removedLinkLine);
});
