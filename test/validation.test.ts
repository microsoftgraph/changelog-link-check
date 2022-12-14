import { expect, test } from '@jest/globals';
import nock from 'nock';
import { FileBrokenLinks, PullListFile } from '../src/types';
import {
  checkFileForBrokenLinks,
  checkFilesForBrokenLinks,
  generateGraphUrl,
  generatePrComment,
  getListOfNewUrls,
  isLineInvalid,
  isUrlInvalid,
  shouldCheckFile,
} from '../src/validation';

const fileList = [
  { file: 'api-reference/some-file.json', included: false },
  { file: 'changelog/some-file.json', included: true },
  { file: 'changelog/subdirectory/some-file.json', included: true },
  { file: 'changelog/some-file.json.txt', included: false },
  { file: '/changelog/some-file.json', included: true },
  { file: '/changelog/subdirectory/some-file.json', included: true },
  { file: '/changelog/some-file.json.txt', included: false },
];

test('Files are correctly included for validation', () => {
  const changeLogDirectory = 'changelog';
  const fileUrlRegex = new RegExp(
    `^\\/?${changeLogDirectory}.*\\.json$`,
    'gim'
  );

  fileList.forEach((file) => {
    expect(shouldCheckFile(file.file, fileUrlRegex)).toBe(file.included);
  });
});

test('404 Graph URLs are detected', async () => {
  const url =
    'https://learn.microsoft.com/en-us/graph/api/not-good/dynamics-graph-reference?view=graph-rest-beta';
  expect(await isUrlInvalid([], url)).toBe(true);
});

test('Bad protocol URLs are detected', async () => {
  const url =
    'htt://learn.microsoft.com/en-us/graph/api/resources/dynamics-graph-reference?view=graph-rest-beta';
  expect(await isUrlInvalid([], url)).toBe(true);
});

test('Valid URL passes', async () => {
  const url =
    'https://learn.microsoft.com/en-us/graph/api/resources/dynamics-graph-reference?view=graph-rest-beta';
  expect(await isUrlInvalid([], url)).toBe(false);
});

test('Invalid link in Markdown is detected', async () => {
  const line =
    '"Description": "Added financials APIs for Dynamics 365 Business Central. For details, see the [Financials API reference](https://learn.microsoft.com/en-us/graph/INVALID/resources/dynamics-graph-reference?view=graph-rest-beta)",';
  expect(await isLineInvalid(line, [])).toBe(true);
});

test('Valid link in Markdown passes', async () => {
  const line =
    '"Description": "Added financials APIs for Dynamics 365 Business Central. For details, see the [Financials API reference](https://learn.microsoft.com/en-us/graph/api/resources/dynamics-graph-reference?view=graph-rest-beta)",';
  expect(await isLineInvalid(line, [])).toBe(false);
});

const badChangeLogFile = `{
  "changelog": [
    {
      "ChangeList": [
        {
          "Id": "230ea331-2105-45d0-bb78-bc0063bc729f",
          "ApiChange": "Resource",
          "ChangedApiName": "Financials API reference",
          "ChangeType": "Addition",
          "Description": "Added financials APIs for Dynamics 365 Business Central. For details, see the [Financials API reference](https://learn.microsoft.com/en-us/graph/api/resources/dynamics-graph-reference?view=graph-rest-1.0).",
          "Target": "Financials API reference"
        }
      ],
      "Id": "230ea331-2105-45d0-bb78-bc0063bc729f",
      "Cloud": "prd",
      "Version": "beta",
      "CreatedDateTime": "2019-03-01T00:00:00",
      "WorkloadArea": "Financials",
      "SubArea": ""
    },
    {
      "ChangeList": [
        {
          "Id": "d950a95c-3700-4c85-98c2-a3daee152fee",
          "ApiChange": "Resource",
          "ChangedApiName": "Financials API reference",
          "ChangeType": "Addition",
          "Description": "Added financials APIs for Dynamics 365 Business Central. For details, see the [Financials API reference](https://learn.microsoft.com/en-us/graph/INVALID/resources/dynamics-graph-reference?view=graph-rest-beta)",
          "Target": "Financials API reference"
        }
      ],
      "Id": "d950a95c-3700-4c85-98c2-a3daee152fee",
      "Cloud": "prd",
      "Version": "beta",
      "CreatedDateTime": "2018-09-01T00:00:00",
      "WorkloadArea": "Financials",
      "SubArea": ""
    }
  ]
}`;

test('Invalid change log file detected and correct line number reported', async () => {
  nock('https://github.com')
    .replyContentLength()
    .get('/changelog.json')
    .reply(200, badChangeLogFile, {
      'Content-Type': 'application/json; charset=utf-8',
    });

  const errorLines = await checkFileForBrokenLinks(
    'https://github.com/changelog.json',
    []
  );

  expect(errorLines).toHaveLength(1);
  expect(errorLines[0]).toBe(28);
});

const goodChangeLogFile = `{
  "changelog": [
    {
      "ChangeList": [
        {
          "Id": "230ea331-2105-45d0-bb78-bc0063bc729f",
          "ApiChange": "Resource",
          "ChangedApiName": "Financials API reference",
          "ChangeType": "Addition",
          "Description": "Added financials APIs for Dynamics 365 Business Central. For details, see the [Financials API reference](https://learn.microsoft.com/en-us/graph/api/resources/dynamics-graph-reference?view=graph-rest-1.0).",
          "Target": "Financials API reference"
        }
      ],
      "Id": "230ea331-2105-45d0-bb78-bc0063bc729f",
      "Cloud": "prd",
      "Version": "beta",
      "CreatedDateTime": "2019-03-01T00:00:00",
      "WorkloadArea": "Financials",
      "SubArea": ""
    },
    {
      "ChangeList": [
        {
          "Id": "d950a95c-3700-4c85-98c2-a3daee152fee",
          "ApiChange": "Resource",
          "ChangedApiName": "Financials API reference",
          "ChangeType": "Addition",
          "Description": "Added financials APIs for Dynamics 365 Business Central. For details, see the [Financials API reference](https://learn.microsoft.com/en-us/graph/api/resources/dynamics-graph-reference?view=graph-rest-beta)",
          "Target": "Financials API reference"
        }
      ],
      "Id": "d950a95c-3700-4c85-98c2-a3daee152fee",
      "Cloud": "prd",
      "Version": "beta",
      "CreatedDateTime": "2018-09-01T00:00:00",
      "WorkloadArea": "Financials",
      "SubArea": ""
    }
  ]
}`;

test('Valid change log file passes', async () => {
  nock('https://github.com')
    .replyContentLength()
    .get('/changelog.json')
    .reply(200, goodChangeLogFile, {
      'Content-Type': 'application/json; charset=utf-8',
    });

  expect(
    await checkFileForBrokenLinks('https://github.com/changelog.json', [])
  ).toHaveLength(0);
});

const errorFiles: FileBrokenLinks[] = [
  {
    fileName: 'file.json',
    brokenLinkLines: [4, 10],
  },
  {
    fileName: 'file2.json',
    brokenLinkLines: [2],
  },
];

const expectedPrComment = `## Changelog link validation failed

The following files in this pull request have invalid links:

- file.json: Line(s) 4,10
- file2.json: Line(s) 2

Please add a commit to this branch that fixes the invalid links.`;

test('PR comment generates correctly', () => {
  expect(generatePrComment(errorFiles)).toBe(expectedPrComment);
});

const pullListFiles: PullListFile[] = [
  {
    sha: '',
    filename: 'changelog/changelog.json',
    status: 'added',
    additions: 0,
    deletions: 0,
    changes: 0,
    blob_url: '',
    raw_url: 'https://github.com/changelog.json',
    contents_url: '',
  },
  {
    sha: '',
    filename: 'api-reference/beta/api/user-list.md',
    status: 'modified',
    additions: 0,
    deletions: 0,
    changes: 0,
    blob_url: '',
    raw_url: '',
    contents_url: '',
  },
  {
    sha: '',
    filename: 'api-reference/v1.0/api/user-list.md',
    status: 'modified',
    additions: 0,
    deletions: 0,
    changes: 0,
    blob_url: '',
    raw_url: '',
    contents_url: '',
  },
  {
    sha: '',
    filename: 'api-reference/beta/resources/user.md',
    status: 'modified',
    additions: 0,
    deletions: 0,
    changes: 0,
    blob_url: '',
    raw_url: '',
    contents_url: '',
  },
  {
    sha: '',
    filename: 'api-reference/v1.0/resources/user.md',
    status: 'modified',
    additions: 0,
    deletions: 0,
    changes: 0,
    blob_url: '',
    raw_url: '',
    contents_url: '',
  },
  {
    sha: '',
    filename: 'api-reference/beta/api/new-api.md',
    status: 'added',
    additions: 0,
    deletions: 0,
    changes: 0,
    blob_url: '',
    raw_url: '',
    contents_url: '',
  },
  {
    sha: '',
    filename: 'api-reference/v1.0/api/new-api.md',
    status: 'added',
    additions: 0,
    deletions: 0,
    changes: 0,
    blob_url: '',
    raw_url: '',
    contents_url: '',
  },
  {
    sha: '',
    filename: 'api-reference/beta/resources/new-resource.md',
    status: 'added',
    additions: 0,
    deletions: 0,
    changes: 0,
    blob_url: '',
    raw_url: '',
    contents_url: '',
  },
  {
    sha: '',
    filename: 'api-reference/v1.0/resources/new-resource.md',
    status: 'added',
    additions: 0,
    deletions: 0,
    changes: 0,
    blob_url: '',
    raw_url: '',
    contents_url: '',
  },
  {
    sha: '',
    filename: 'concepts/new-conceptual-topic.md',
    status: 'added',
    additions: 0,
    deletions: 0,
    changes: 0,
    blob_url: '',
    raw_url: '',
    contents_url: '',
  },
];

const changeLogFileWithNewFiles = `{
  "changelog": [
    {
      "ChangeList": [
        {
          "Id": "230ea331-2105-45d0-bb78-bc0063bc729f",
          "ApiChange": "Resource",
          "ChangedApiName": "Financials API reference",
          "ChangeType": "Addition",
          "Description": "Changed [link](https://learn.microsoft.com/en-us/graph/api/user-list?view=graph-rest-beta).",
          "Target": "Financials API reference"
        },
        {
          "Id": "230ea331-2105-45d0-bb78-bc0063bc729f",
          "ApiChange": "Resource",
          "ChangedApiName": "Financials API reference",
          "ChangeType": "Addition",
          "Description": "Changed [link](https://learn.microsoft.com/en-us/graph/api/user-list?view=graph-rest-1.0).",
          "Target": "Financials API reference"
        },
        {
          "Id": "230ea331-2105-45d0-bb78-bc0063bc729f",
          "ApiChange": "Resource",
          "ChangedApiName": "Financials API reference",
          "ChangeType": "Addition",
          "Description": "Changed [link](https://learn.microsoft.com/en-us/graph/api/resources/user?view=graph-rest-beta).",
          "Target": "Financials API reference"
        },
        {
          "Id": "230ea331-2105-45d0-bb78-bc0063bc729f",
          "ApiChange": "Resource",
          "ChangedApiName": "Financials API reference",
          "ChangeType": "Addition",
          "Description": "Changed [link](https://learn.microsoft.com/en-us/graph/api/resources/user?view=graph-rest-1.0).",
          "Target": "Financials API reference"
        },
        {
          "Id": "230ea331-2105-45d0-bb78-bc0063bc729f",
          "ApiChange": "Resource",
          "ChangedApiName": "Financials API reference",
          "ChangeType": "Addition",
          "Description": "Changed [link](https://learn.microsoft.com/en-us/graph/api/new-api?view=graph-rest-beta).",
          "Target": "Financials API reference"
        },
        {
          "Id": "230ea331-2105-45d0-bb78-bc0063bc729f",
          "ApiChange": "Resource",
          "ChangedApiName": "Financials API reference",
          "ChangeType": "Addition",
          "Description": "Changed [link](https://learn.microsoft.com/en-us/graph/api/new-api?view=graph-rest-1.0).",
          "Target": "Financials API reference"
        },
        {
          "Id": "230ea331-2105-45d0-bb78-bc0063bc729f",
          "ApiChange": "Resource",
          "ChangedApiName": "Financials API reference",
          "ChangeType": "Addition",
          "Description": "Changed [link](https://learn.microsoft.com/en-us/graph/api/resources/new-resource?view=graph-rest-beta).",
          "Target": "Financials API reference"
        },
        {
          "Id": "230ea331-2105-45d0-bb78-bc0063bc729f",
          "ApiChange": "Resource",
          "ChangedApiName": "Financials API reference",
          "ChangeType": "Addition",
          "Description": "Changed [link](https://learn.microsoft.com/en-us/graph/api/resources/new-resource?view=graph-rest-1.0).",
          "Target": "Financials API reference"
        },
        {
          "Id": "230ea331-2105-45d0-bb78-bc0063bc729f",
          "ApiChange": "Resource",
          "ChangedApiName": "Financials API reference",
          "ChangeType": "Addition",
          "Description": "Changed [link](https://learn.microsoft.com/en-us/graph/new-conceptual-topic).",
          "Target": "Financials API reference"
        }
      ],
      "Id": "230ea331-2105-45d0-bb78-bc0063bc729f",
      "Cloud": "prd",
      "Version": "beta",
      "CreatedDateTime": "2019-03-01T00:00:00",
      "WorkloadArea": "Financials",
      "SubArea": ""
    }
  ]
}`;

test('Graph URLs generate correctly from file names', () => {
  const resourceFile = 'api-reference/v1.0/resources/new-resource.md';
  const resourceUrl =
    'https://learn.microsoft.com/en-us/graph/api/resources/new-resource?view=graph-rest-1.0';
  const apiFile = 'api-reference/beta/api/new-api.md';
  const apiUrl =
    'https://learn.microsoft.com/en-us/graph/api/new-api?view=graph-rest-beta';
  const conceptFile = 'concepts/new-conceptual-topic.md';
  const conceptUrl =
    'https://learn.microsoft.com/en-us/graph/new-conceptual-topic';

  const fileWithCaps = 'api-reference/beta/resources/coachmarkLocation.md';
  const urlWithoutCaps =
    'https://learn.microsoft.com/en-us/graph/api/resources/coachmarklocation?view=graph-rest-beta';

  expect(generateGraphUrl(resourceFile)).toBe(resourceUrl);
  expect(generateGraphUrl(apiFile)).toBe(apiUrl);
  expect(generateGraphUrl(conceptFile)).toBe(conceptUrl);
  expect(generateGraphUrl(fileWithCaps)).toBe(urlWithoutCaps);
});

test('List of new URLs should be generated from added files', () => {
  const newUrls = getListOfNewUrls(pullListFiles);

  expect(newUrls.length).toBe(5);
});

test('URLs to files added in PR should not fail validation', async () => {
  nock('https://github.com')
    .replyContentLength()
    .get('/changelog.json')
    .reply(200, changeLogFileWithNewFiles, {
      'Content-Type': 'application/json; charset=utf-8',
    });

  const changeLogDirectory = 'changelog';
  const errorFiles = await checkFilesForBrokenLinks(
    pullListFiles,
    changeLogDirectory
  );

  console.log(JSON.stringify(errorFiles));

  expect(errorFiles.length).toBe(0);
});
