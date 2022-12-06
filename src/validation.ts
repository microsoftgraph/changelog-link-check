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

  for (const file of files) {
    if (shouldCheckFile(file.filename, fileUrlRegex)) {
      const errorLines = await checkFileForBrokenLinks(file.raw_url);
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
  const yes = match.test(file);
  console.log(`Checking ${file}: ${yes}`);
  return yes;
}

export async function checkFileForBrokenLinks(
  fileUrl: string
): Promise<number[]> {
  const response = await fetch(fileUrl);
  const content = await response.text();
  const lines = content.split('\n');

  const errorLines: number[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (await isLineInvalid(lines[i])) {
      errorLines.push(i + 1);
    }
  }

  return errorLines;
}

export async function isLineInvalid(line: string): Promise<boolean> {
  const mdLink = /\[.*\]\((?<url>.*)\)/g;

  const matches = line.matchAll(mdLink);
  for (const match of matches) {
    const url = match.groups?.url;
    if (await isUrlInvalid(url)) {
      return true;
    }
  }

  return false;
}

export async function isUrlInvalid(url?: string): Promise<boolean> {
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
    return !response.ok;
  } catch (e) {
    return true;
  }
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
