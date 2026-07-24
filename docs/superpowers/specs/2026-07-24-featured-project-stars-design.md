# Featured Project Star Updater

## Goal

Keep the star counts in the README's Featured Projects table synchronized with
GitHub automatically.

## Design

Add `scripts/update-project-stars.mjs`, a dependency-free Node.js script that:

1. Reads `README.md`.
2. Locates the Featured Projects table.
3. Extracts each `github.com/<owner>/<repository>` link from the table rows.
4. Requests each repository's current `stargazers_count` from the GitHub API.
5. Replaces only the corresponding Stars cell.
6. Writes the README only when at least one count changed.

The script will use `GITHUB_TOKEN` when available and will continue to work
against public repositories without a token. Network requests will be
sequential and retry transient failures, matching the reliability pattern used
by the blog updater.

## Workflow Integration

The existing daily blog workflow will become the profile-content workflow. It
will run the blog updater and project-star updater before its existing commit
step, producing at most one README commit per run. Both README workflows will
continue sharing the `readme-updaters` concurrency group to prevent competing
pushes.

## Error Handling

The updater will fail without changing the README when:

- the Featured Projects table cannot be found;
- a table row has an invalid GitHub repository URL;
- GitHub returns an unrecoverable API error; or
- a response does not contain a numeric `stargazers_count`.

Transient network and server errors will be retried before failing the job.

## Testing

Node's built-in test runner will verify:

- repository extraction from the existing table format;
- replacement of only the Stars cells;
- unchanged surrounding README content;
- rejection of malformed API data; and
- the workflow invokes the updater before committing.

After implementation, verification will include the complete local test suite,
YAML parsing, an idempotency run, and a manually dispatched GitHub Actions run.
