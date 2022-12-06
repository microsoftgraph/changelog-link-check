// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { components } from '@octokit/openapi-types';

export type PullListFile = components['schemas']['diff-entry'];

export type FileBrokenLinks = {
  fileName: string;
  brokenLinkLines: number[];
};
