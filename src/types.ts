// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { components } from '@octokit/openapi-types';

export type PullListFile = components['schemas']['diff-entry'];

export type BrokenLink = {
  lineNumber: number;
  link: string;
};

export type FileBrokenLinks = {
  fileName: string;
  brokenLinks: BrokenLink[];
};
