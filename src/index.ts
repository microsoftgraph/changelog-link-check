// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as core from '@actions/core';
import * as github from '@actions/github';
import { PullRequestEvent } from '@octokit/webhooks-types';
import { checkFilesForBrokenLinks, generatePrComment } from './validation';
import { FileBrokenLinks } from './types';

async function run(): Promise<void> {
  try {
    // Should only execute for pull requests
    if (github.context.eventName === 'pull_request_target') {
      // Get the token and configure an octokit client
      const repoToken = core.getInput('repoToken', { required: true });
      const changeLogDirectory = core.getInput('changeLogDirectory', {
        required: true,
      });
      const octokit = github.getOctokit(repoToken);

      // Get the payload of the event
      const pullPayload = github.context.payload as PullRequestEvent;

      // Get all files in the pull request
      const files = await octokit.paginate(
        'GET /repos/{owner}/{repo}/pulls/{pull_number}/files',
        {
          owner: github.context.repo.owner,
          repo: github.context.repo.repo,
          pull_number: pullPayload.pull_request.number,
        },
      );

      let errorFiles: FileBrokenLinks[] = [];
      try {
        errorFiles = await checkFilesForBrokenLinks(files, changeLogDirectory);
      } catch (e) {
        core.warning(`Caught error during file check: ${JSON.stringify(e)}`);
      }

      core.info(
        `File check complete. ${errorFiles.length} files with broken links.`,
      );

      if (errorFiles.length > 0) {
        const comment = generatePrComment(errorFiles);

        try {
          // Post the comment in the pull request
          await octokit.rest.issues.createComment({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            issue_number: pullPayload.pull_request.number,
            body: comment,
          });
        } catch (createCommentError) {
          core.warning(
            `Unable to create comment\n${JSON.stringify(createCommentError)}`,
          );
        }

        // Add the invalid links label
        try {
          await octokit.rest.issues.addLabels({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            issue_number: pullPayload.pull_request.number,
            labels: ['invalid links'],
          });
        } catch (addLabelError) {
          core.warning(`Unable to add label\n${JSON.stringify(addLabelError)}`);
        }

        // Indicate failure to block pull request
        core.setFailed('Files with invalid links detected in pull request');
      } else {
        // No invalid links, remove label if present
        try {
          await octokit.rest.issues.removeLabel({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            issue_number: pullPayload.pull_request.number,
            name: 'invalid links',
          });
        } catch (removeLabelError) {
          // If label wasn't there, this returns an error
          const error = removeLabelError as Error;
          if (error.message !== 'Label does not exist') {
            core.warning(
              `Unable to remove label\n${JSON.stringify(removeLabelError)}`,
            );
          }
        }
      }
    }
  } catch (error) {
    // General error
    core.setFailed(`Unexpected error: \n${JSON.stringify(error)}`);
  }
}

run();
