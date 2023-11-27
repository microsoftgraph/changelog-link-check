// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import fetch, { FetchError } from 'node-fetch';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { BrokenLink, FileBrokenLinks, PullListFile } from './types';
import { components } from '@octokit/openapi-types';
import * as UserStrings from './strings';

export type FileContents = components['schemas']['content-file'];

const knownGoodUrls: string[] = [];
const knownBadUrls: string[] = [];

export async function checkFilesForBrokenLinks(
  files: PullListFile[],
  changeLogDirectory: string,
): Promise<FileBrokenLinks[]> {
  const errorFiles: FileBrokenLinks[] = [];

  const fileUrlRegex = new RegExp(
    `^\\/?${changeLogDirectory}.*\\.json$`,
    'gim',
  );

  const newUrls = getListOfNewUrls(files);

  for (const file of files) {
    if (shouldCheckFile(file.filename, fileUrlRegex)) {
      console.log(`Checking ${file.filename}`);
      const brokenLinks = await checkFileForBrokenLinks(file.filename, newUrls);
      if (brokenLinks.length > 0) {
        errorFiles.push({
          fileName: file.filename,
          brokenLinks: brokenLinks,
        });
      }
    } else {
      console.log(`Skipping ${file.filename}`);
    }
  }

  return errorFiles;
}

export function shouldCheckFile(file: string, match: RegExp): boolean {
  match.lastIndex = 0;
  return match.test(file);
}

export async function checkFileForBrokenLinks(
  filePath: string,
  newUrls: string[],
): Promise<BrokenLink[]> {
  const lines = await getFileContents(filePath);

  const brokenLinks: BrokenLink[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const invalidLinks = await getInvalidLinks(lines[i], newUrls);
    for (const link of invalidLinks) {
      brokenLinks.push({
        lineNumber: i + 1,
        link: link,
      });
    }
  }

  return brokenLinks;
}

export async function getFileContents(filePath: string): Promise<string[]> {
  const fullFilePath = join(process.env.GITHUB_WORKSPACE ?? '.', filePath);
  const content = await readFile(fullFilePath, { encoding: 'utf8' });
  return content.split('\n');
}

export async function getInvalidLinks(
  line: string,
  newUrls: string[],
): Promise<string[]> {
  const mdLink = /\[.*?\]\((?<url>.*?)\)/g;

  const invalidLinks: string[] = [];

  const matches = line.matchAll(mdLink);
  for (const match of matches) {
    const url = match.groups?.url;
    if (await isUrlInvalid(newUrls, url)) {
      if (url) {
        invalidLinks.push(url);
      }
    }
  }

  return invalidLinks;
}

export async function isLineInvalid(
  line: string,
  newUrls: string[],
): Promise<boolean> {
  const mdLink = /\[.*?\]\((?<url>.*?)\)/g;

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
  url?: string,
): Promise<boolean> {
  if (!url) return true;

  // Check known bad URLs
  if (knownBadUrls.includes(url)) {
    return true;
  }

  // Check known good URLs
  if (knownGoodUrls.includes(url)) {
    return false;
  }

  // Is it formatted correctly?
  try {
    new URL(url);
  } catch (e) {
    knownBadUrls.push(url);
    return true;
  }

  // Does it resolve?
  try {
    const response = await fetch(url, { method: 'HEAD' });
    if (response.ok) {
      knownGoodUrls.push(url);
      return false;
    }
  } catch (e) {
    if (e instanceof FetchError && e.code === 'ETIMEDOUT') {
      // Give it one more shot
      try {
        const response = await fetch(url, { method: 'HEAD' });
        if (response.ok) {
          knownGoodUrls.push(url);
          return false;
        }
      } catch (e) {
        knownBadUrls.push(url);
        return true;
      }
    }
    knownBadUrls.push(url);
    return true;
  }

  // Is it a new file in this PR that isn't published yet?
  return !newUrls.includes(url.toLowerCase());
}

export function generatePrComment(errorFiles: FileBrokenLinks[]): string {
  let fileList = '';

  // Create a bulleted list of the files and line numbers
  for (const file of errorFiles) {
    fileList += `- ${file.fileName}:\n`;
    for (const link of file.brokenLinks) {
      fileList += `  - Line ${link.lineNumber}: \`${link.link}\`\n`;
    }
  }

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

    return `${graphRootUrl}${relativeUrl}`.toLowerCase();
  } else if (fileNameNoExtension.startsWith('concepts')) {
    const relativeUrl = fileNameNoExtension.replace(/^concepts/, '');
    return `${graphRootUrl}${relativeUrl}`.toLowerCase();
  } else {
    return undefined;
  }
}
