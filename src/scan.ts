// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { readdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { checkFileForBrokenLinks, getFileContents } from './validation';
import { BrokenLink } from './types';

async function scan() {
  const changelogArgIndex = process.argv.indexOf('--changelog-directory');
  const removeBrokenLinks = process.argv.includes('--remove-broken-links');
  if (changelogArgIndex > 0) {
    const changelogDirectory = process.argv[changelogArgIndex + 1];
    console.log(`Validating changelog files in ${changelogDirectory}`);
    if (removeBrokenLinks) {
      console.log('BROKEN LINKS WILL BE REMOVED');
    }

    const changeLogFiles = await readdir(changelogDirectory);

    const csvFileLines: string[] = ['File,Line,Link'];

    for (const file of changeLogFiles) {
      if (file.toLowerCase() === 'changelog.schema.json') {
        continue;
      }

      console.log(`Scanning ${file}...`);
      const brokenLinks = await checkFileForBrokenLinks(
        join(changelogDirectory, file),
        [],
      );

      if (brokenLinks.length > 0) {
        console.log('Broken links found:');
        for (const link of brokenLinks) {
          csvFileLines.push(`${file},${link.lineNumber},${link.link}`);
          console.log(`Line ${link.lineNumber}: ${link.link}`);
        }

        if (removeBrokenLinks) {
          removeBrokenLinksFromFile(
            join(changelogDirectory, file),
            brokenLinks,
          );
        }
      }
    }

    if (csvFileLines.length > 1) {
      console.log(`Found ${csvFileLines.length - 1} broken links.`);
      await writeFile('brokenFiles.csv', csvFileLines.join('\n'));
    }
  } else {
    console.log(
      'Please provide the path to your local changelog directory in the --changelog-directory parameter.',
    );
  }
}

export async function removeBrokenLinksFromFile(
  filePath: string,
  brokenLinks: BrokenLink[],
) {
  const lines = await getFileContents(filePath);

  for (const link of brokenLinks) {
    const newLine = removeLinkFromLine(lines[link.lineNumber - 1], link.link);
    lines[link.lineNumber - 1] = newLine;
  }

  await writeFile(filePath, lines.join('\n'));
}

export function removeLinkFromLine(line: string, link: string): string {
  const linkRegex = new RegExp(
    `\\[(?<linkText>[^\\]]*?)\\]\\(${escapeUrlForRegex(link)}\\)`,
    'g',
  );
  return line.replace(linkRegex, '**$1**');
}

export function escapeUrlForRegex(url: string): string {
  return url.replace('.', '\\.').replace('?', '\\?');
}

scan();
