# Featured Project Stars Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically synchronize the Featured Projects star counts in `README.md` with the GitHub API.

**Architecture:** A dependency-free Node.js script will parse repository links from the Featured Projects table, fetch each `stargazers_count` sequentially with retries, and replace only the Stars cells. The existing daily profile-content workflow will run the star and blog updaters before making one conditional README commit.

**Tech Stack:** Node.js 22+, built-in `fetch`, built-in `node:test`, GitHub Actions, GitHub REST API.

---

## File Structure

- Create `scripts/update-project-stars.mjs`: table parsing, GitHub API access, star replacement, and CLI entry point.
- Create `test/update-project-stars.test.mjs`: unit tests for parsing, replacement, API validation, and retries.
- Modify `test/profile-pipelines.test.mjs`: workflow contract asserting the star updater runs before the commit step.
- Modify `.github/workflows/blog-post-workflow.yml`: rename it to profile content and invoke the new updater with `GITHUB_TOKEN`.
- Modify `README.md`: generated star-count update from the first local updater run.

### Task 1: Parse and update the Featured Projects table

**Files:**
- Create: `test/update-project-stars.test.mjs`
- Create: `scripts/update-project-stars.mjs`

- [ ] **Step 1: Write failing parser and replacement tests**

Create `test/update-project-stars.test.mjs` with:

```js
import assert from "node:assert/strict";
import test from "node:test";

import {
  extractProjects,
  replaceStarCounts,
} from "../scripts/update-project-stars.mjs";

const readme = `Before
## 🚀 Featured Projects

| Project | Description | Stars |
|---------|-------------|:-----:|
| [alpha](https://github.com/example/alpha) | First project | ⭐ 1 |
| [beta](https://github.com/example/beta) | Second project | ⭐ 20 |

---
After`;

test("extracts repositories from the Featured Projects table", () => {
  assert.deepEqual(extractProjects(readme), [
    { owner: "example", repo: "alpha" },
    { owner: "example", repo: "beta" },
  ]);
});

test("updates only matching Stars cells", () => {
  const updated = replaceStarCounts(
    readme,
    new Map([
      ["example/alpha", 7],
      ["example/beta", 24],
    ]),
  );

  assert.match(updated, /\| \[alpha\].* \| ⭐ 7 \|/);
  assert.match(updated, /\| \[beta\].* \| ⭐ 24 \|/);
  assert.match(updated, /^Before/m);
  assert.match(updated, /^After/m);
});

test("rejects a README without a Featured Projects table", () => {
  assert.throws(
    () => extractProjects("# Profile"),
    /Featured Projects table was not found/,
  );
});
```

- [ ] **Step 2: Run the tests and verify the expected failure**

Run:

```bash
node --test test/update-project-stars.test.mjs
```

Expected: FAIL because `scripts/update-project-stars.mjs` does not exist.

- [ ] **Step 3: Implement table parsing and count replacement**

Create `scripts/update-project-stars.mjs` with these exports:

```js
import { readFile, writeFile } from "node:fs/promises";

const README_PATH = new URL("../README.md", import.meta.url);
const SECTION_HEADING = "## 🚀 Featured Projects";
const PROJECT_ROW =
  /^\| \[[^\]]+\]\(https:\/\/github\.com\/([^/\s]+)\/([^)\s/]+)\/?\) \| .+ \| ⭐ \d+ \|$/gm;

function featuredProjectsSection(readme) {
  const start = readme.indexOf(SECTION_HEADING);
  if (start === -1) {
    throw new Error("Featured Projects table was not found");
  }
  const end = readme.indexOf("\n---", start);
  if (end === -1) {
    throw new Error("Featured Projects section has no closing separator");
  }
  return readme.slice(start, end);
}

export function extractProjects(readme) {
  const section = featuredProjectsSection(readme);
  const projects = [...section.matchAll(PROJECT_ROW)].map((match) => ({
    owner: match[1],
    repo: match[2],
  }));
  if (projects.length === 0) {
    throw new Error("Featured Projects table contains no repository rows");
  }
  return projects;
}

export function replaceStarCounts(readme, counts) {
  const section = featuredProjectsSection(readme);
  const updatedSection = section.replace(
    PROJECT_ROW,
    (row, owner, repo) => {
      const key = `${owner}/${repo}`;
      if (!counts.has(key)) {
        throw new Error(`Missing star count for ${key}`);
      }
      return row.replace(/⭐ \d+ \|$/, `⭐ ${counts.get(key)} |`);
    },
  );
  return readme.replace(section, updatedSection);
}
```

- [ ] **Step 4: Run the focused tests**

Run:

```bash
node --test test/update-project-stars.test.mjs
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit the parsing behavior**

```bash
git add scripts/update-project-stars.mjs test/update-project-stars.test.mjs
git commit -m "feat: update featured project star counts"
```

### Task 2: Add reliable GitHub API fetching and CLI behavior

**Files:**
- Modify: `test/update-project-stars.test.mjs`
- Modify: `scripts/update-project-stars.mjs`

- [ ] **Step 1: Write failing API behavior tests**

Append to `test/update-project-stars.test.mjs`:

```js
import { fetchStarCount } from "../scripts/update-project-stars.mjs";

test("reads a numeric star count from GitHub", async () => {
  const fetchImpl = async () =>
    new Response(JSON.stringify({ stargazers_count: 42 }), {
      headers: { "content-type": "application/json" },
    });

  assert.equal(
    await fetchStarCount("example", "alpha", {
      fetchImpl,
      retryDelayMs: 0,
    }),
    42,
  );
});

test("rejects malformed GitHub API data", async () => {
  const fetchImpl = async () =>
    new Response(JSON.stringify({ stargazers_count: "many" }));

  await assert.rejects(
    fetchStarCount("example", "alpha", {
      fetchImpl,
      retryDelayMs: 0,
    }),
    /invalid stargazers_count/,
  );
});

test("retries transient GitHub failures", async () => {
  let attempts = 0;
  const fetchImpl = async () => {
    attempts += 1;
    if (attempts < 3) throw new Error("read ECONNRESET");
    return new Response(JSON.stringify({ stargazers_count: 8 }));
  };

  assert.equal(
    await fetchStarCount("example", "alpha", {
      attempts: 3,
      fetchImpl,
      retryDelayMs: 0,
    }),
    8,
  );
  assert.equal(attempts, 3);
});
```

- [ ] **Step 2: Run the focused tests and verify failure**

Run:

```bash
node --test test/update-project-stars.test.mjs
```

Expected: FAIL because `fetchStarCount` is not exported.

- [ ] **Step 3: Implement API fetching, retries, and the CLI**

Add to `scripts/update-project-stars.mjs` before the CLI guard:

```js
export async function fetchStarCount(
  owner,
  repo,
  {
    attempts = 3,
    fetchImpl = fetch,
    retryDelayMs = 1_000,
    token = process.env.GITHUB_TOKEN,
  } = {},
) {
  const url = `https://api.github.com/repos/${owner}/${repo}`;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const headers = {
        accept: "application/vnd.github+json",
        "user-agent": "MovieMaker93-profile-readme-updater",
        "x-github-api-version": "2022-11-28",
      };
      if (token) headers.authorization = `Bearer ${token}`;

      const response = await fetchImpl(url, {
        headers,
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        const error = new Error(`${url} returned HTTP ${response.status}`);
        error.retryable = response.status === 429 || response.status >= 500;
        throw error;
      }
      const data = await response.json();
      if (!Number.isInteger(data.stargazers_count)) {
        const error = new Error(
          `${owner}/${repo} returned an invalid stargazers_count`,
        );
        error.retryable = false;
        throw error;
      }
      return data.stargazers_count;
    } catch (error) {
      if (attempt === attempts || error.retryable === false) throw error;
      await new Promise((resolve) =>
        setTimeout(resolve, retryDelayMs * attempt),
      );
    }
  }
  throw new Error(`Failed to fetch stars for ${owner}/${repo}`);
}

async function main() {
  const readme = await readFile(README_PATH, "utf8");
  const projects = extractProjects(readme);
  const counts = new Map();

  for (const { owner, repo } of projects) {
    counts.set(
      `${owner}/${repo}`,
      await fetchStarCount(owner, repo),
    );
  }

  const updatedReadme = replaceStarCounts(readme, counts);
  if (updatedReadme === readme) {
    console.log("Featured project stars are already up to date");
    return;
  }
  await writeFile(README_PATH, updatedReadme);
  console.log(`Updated star counts for ${projects.length} featured projects`);
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  await main();
}
```

- [ ] **Step 4: Run focused and complete tests**

Run:

```bash
node --test test/update-project-stars.test.mjs
node --test test/*.test.mjs
```

Expected: all focused tests and the complete suite pass.

- [ ] **Step 5: Run the updater against GitHub**

Run:

```bash
GITHUB_TOKEN="$(gh auth token)" node scripts/update-project-stars.mjs
```

Expected: `README.md` changes `devpod-dotfiles-chezmoi` from 22 to the current
GitHub count and reports four updated projects. A second run reports that the
counts are already up to date.

- [ ] **Step 6: Commit API and generated README changes**

```bash
git add scripts/update-project-stars.mjs test/update-project-stars.test.mjs README.md
git commit -m "feat: sync featured project stars from GitHub"
```

### Task 3: Integrate the updater into the daily workflow

**Files:**
- Modify: `test/profile-pipelines.test.mjs`
- Modify: `.github/workflows/blog-post-workflow.yml`

- [ ] **Step 1: Write the failing workflow contract test**

Append to `test/profile-pipelines.test.mjs`:

```js
test("profile workflow updates project stars before committing", () => {
  const updatePosition = blogWorkflow.indexOf(
    "node scripts/update-project-stars.mjs",
  );
  const commitPosition = blogWorkflow.indexOf("git commit");

  assert.ok(updatePosition >= 0);
  assert.ok(commitPosition > updatePosition);
  assert.match(
    blogWorkflow,
    /GITHUB_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \}\}/,
  );
});
```

- [ ] **Step 2: Run the contract test and verify failure**

Run:

```bash
node --test test/profile-pipelines.test.mjs
```

Expected: FAIL because the workflow does not invoke the star updater.

- [ ] **Step 3: Update the profile-content workflow**

In `.github/workflows/blog-post-workflow.yml`:

- Change `name: Latest blog posts` to `name: Update profile content`.
- Change the job name to `Update README profile content`.
- Insert this step after the blog updater and before `Commit README`:

```yaml
      - name: Update featured project stars
        run: node scripts/update-project-stars.mjs
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

- Change the commit message to:

```bash
git commit -m "docs: update profile content"
```

- [ ] **Step 4: Run all local verification**

Run:

```bash
node --test test/*.test.mjs
node --check scripts/update-project-stars.mjs
node --check scripts/update-blog-posts.mjs
ruby -e 'require "yaml"; Dir[".github/workflows/*.yml"].each { |file| YAML.parse_file(file) }'
git diff --check
```

Expected: all tests pass, both scripts parse, all workflow files parse, and
`git diff --check` emits no output.

- [ ] **Step 5: Commit workflow integration**

```bash
git add .github/workflows/blog-post-workflow.yml test/profile-pipelines.test.mjs
git commit -m "ci: automate featured project star updates"
```

### Task 4: Push and verify the live workflow

**Files:**
- No file changes expected.

- [ ] **Step 1: Push the completed commits**

```bash
git fetch origin main
git rev-list --left-right --count HEAD...origin/main
git push origin main
```

Expected: the divergence check reports that local is ahead only, and the push
updates `origin/main` without force.

- [ ] **Step 2: Dispatch the profile-content workflow**

```bash
gh workflow run blog-post-workflow.yml \
  --repo MovieMaker93/MovieMaker93 \
  --ref main
```

Expected: GitHub accepts the dispatch.

- [ ] **Step 3: Watch the dispatched run**

Capture the newest dispatch and watch it:

```bash
profile_run_id="$(gh run list \
  --repo MovieMaker93/MovieMaker93 \
  --workflow blog-post-workflow.yml \
  --event workflow_dispatch \
  --limit 1 \
  --json databaseId \
  --jq '.[0].databaseId')"
gh run watch "$profile_run_id" \
  --repo MovieMaker93/MovieMaker93 \
  --exit-status \
  --interval 3
```

Expected: checkout, blog update, star update, and commit steps all succeed.

- [ ] **Step 4: Confirm local and remote state**

```bash
git fetch origin main
git rev-parse HEAD
git rev-parse origin/main
git status --short
```

Expected: local and remote SHAs match and the working tree is clean. If the
workflow generated a README commit, fast-forward local `main` first and repeat
the checks.
