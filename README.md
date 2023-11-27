# Changelog link checker

[![Node.js CI](https://github.com/microsoftgraph/changelog-link-check/actions/workflows/node.yml/badge.svg)](https://github.com/microsoftgraph/changelog-link-check/actions/workflows/node.yml) ![License.](https://img.shields.io/badge/license-MIT-green.svg)

This GitHub action blocks pull requests that include invalid links in changelog files. It is compatible with the changelog format used by the [microsoftgraph/microsoft-graph-docs](https://github.com/microsoftgraph/microsoft-graph-docs) repo.

## Setup

1. **OPTIONAL:** Create a label in your repository named `invalid links`. The action will flag pull requests with bad line endings with this tag, and will create it if it isn't present.

1. To install this action, create a .yml file in **.github\workflows** directory, with the following syntax. See [Inputs](#inputs) below for info on the inputs. (See [test.yml](.github\workflows\test.yml) in this repository for an example).

    ```yml
    name: Changelog link check

    on:
      pull_request:
        branches: [ main ]

    permissions:
      pull-requests: write

    jobs:
      check_pull_request:
        name: Check files for broken links
        runs-on: ubuntu-latest
        steps:
        steps:
        - uses: actions/checkout@v4
        - name: Validate files
          id: validate
          with:
            repoToken: ${{ secrets.GITHUB_TOKEN }}
            changeLogDirectory: test-files
          uses: microsoftgraph/changelog-link-check@v1
    ```

1. If you wish to block merges that are flagged by this action, set the **Check files for broken links** check as a [required status check](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/about-protected-branches#require-status-checks-before-merging).

## Inputs

| Input                | Required? | Description                                                            |
|----------------------|-----------|------------------------------------------------------------------------|
| `repoToken`          | Yes       | A token that allows the action read/write access to pull requests in your repository. This SHOULD be set to the default GitHub Actions token (`${{ secrets.GITHUB_TOKEN }}`, but MAY be set to a personal access token stored in a repository secret. |
| `changeLogDirectory` | Yes       | Relative path from the root of your repository to the directory that contains your changelog files. |

## Code of conduct

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.
