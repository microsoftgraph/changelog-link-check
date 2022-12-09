// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
import fetch from 'node-fetch';
import { FileBrokenLinks, PullListFile } from './types';
import * as UserStrings from './strings';

export async function checkFilesForBrokenLinks(
  files: PullListFile[],
  changeLogDirectory: string
): Promise<FileBrokenLinks[]> {
  const errorFiles: FileBrokenLinks[] = [];

  const fileUrlRegex = new RegExp(
    `^\\/?${changeLogDirectory}.*\\.json$`,
    'gim'
  );

  const newUrls = getListOfNewUrls(files);

  for (const file of files) {
    if (shouldCheckFile(file.filename, fileUrlRegex)) {
      const errorLines = await checkFileForBrokenLinks(file.raw_url, newUrls);
      if (errorLines.length > 0) {
        errorFiles.push({
          fileName: file.filename,
          brokenLinkLines: errorLines,
        });
      }
    }
  }

  return errorFiles;
}

export function shouldCheckFile(file: string, match: RegExp): boolean {
  match.lastIndex = 0;
  return match.test(file);
}

export async function checkFileForBrokenLinks(
  fileUrl: string,
  newUrls: string[]
): Promise<number[]> {
  const response = await fetch(fileUrl);
  const content = await response.text();
  const lines = content.split('\n');

  const errorLines: number[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (await isLineInvalid(lines[i], newUrls)) {
      errorLines.push(i + 1);
    }
  }

  return errorLines;
}

export async function isLineInvalid(
  line: string,
  newUrls: string[]
): Promise<boolean> {
  const mdLink = /\[.*\]\((?<url>.*)\)/g;

  const matches = line.matchAll(mdLink);
  for (const match of matches) {
    const url = match.groups?.url;
    if (await isUrlInvalid(newUrls, url)) {
      return true;
    }
  }

  return false;
}

export async function isUrlInvalid(
  newUrls: string[],
  url?: string
): Promise<boolean> {
  if (!url) return true;

  // Is it formatted correctly?
  try {
    new URL(url);
  } catch (e) {
    return true;
  }

  // Does it resolve?
  try {
    const response = await fetch(url, { method: 'HEAD' });
    if (response.ok) return false;
  } catch (e) {
    return true;
  }

  // Is it a new file in this PR that isn't published yet?
  return !newUrls.includes(url.toLowerCase());
}

export function generatePrComment(errorFiles: FileBrokenLinks[]): string {
  let fileList = '';

  // Create a bulleted list of the files and line numbers
  errorFiles.forEach((file) => {
    const lineNumbers = file.brokenLinkLines.join(',');
    fileList += `- ${file.fileName}: Line(s) ${lineNumbers}\n`;
  });

  return `${UserStrings.PR_REPORT_HEADER}
${fileList}
${UserStrings.PR_REPORT_FOOTER}`;
}

export function getListOfNewUrls(files: PullListFile[]): string[] {
  const newUrls: string[] = [];

  for (const file of files) {
    if (file.status === 'added') {
      const url = generateGraphUrl(file.filename);
      if (url) {
        newUrls.push(url);
      }
    }
  }

  return newUrls;
}

const graphRootUrl = 'https://learn.microsoft.com/en-us/graph';

export function generateGraphUrl(fileName: string): string | undefined {
  const fileNameNoExtension = fileName.replace(/\.[^.]*$/, '');

  if (fileNameNoExtension.startsWith('api-reference')) {
    // Reference topic
    const pathParts = fileNameNoExtension.split('/');

    if (pathParts[2] !== 'api' && pathParts[2] !== 'resources') {
      // Not valid
      return undefined;
    }

    let relativeUrl = `/${pathParts[2] === 'api' ? 'api' : 'api/resources'}`;

    if (pathParts[1] !== 'v1.0' && pathParts[1] !== 'beta') {
      // Not valid
      return undefined;
    }
    let version = pathParts[1];
    if (version.startsWith('v')) {
      version = '1.0';
    }

    const restOfUrl = pathParts.slice(3).join('/');

    relativeUrl = `${relativeUrl}/${restOfUrl}?view=graph-rest-${version}`;

    return `${graphRootUrl}${relativeUrl}`;
  } else if (fileNameNoExtension.startsWith('concepts')) {
    const relativeUrl = fileNameNoExtension.replace(/^concepts/, '');
    return `${graphRootUrl}${relativeUrl}`;
  } else {
    return undefined;
  }
}
