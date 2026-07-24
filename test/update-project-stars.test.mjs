import assert from "node:assert/strict";
import test from "node:test";

import {
  extractProjects,
  replaceStarCounts,
} from "../scripts/update-project-stars.mjs";

const featuredProjectsReadme = `Before
## 🚀 Featured Projects

| Project | Description | Stars |
|---------|-------------|:-----:|
| [alpha](https://github.com/example/alpha) | First project | ⭐ 1 |
| [beta](https://github.com/example/beta) | Second project | ⭐ 20 |

---
After`;

test("extracts repositories from the Featured Projects table", () => {
  assert.deepEqual(extractProjects(featuredProjectsReadme), [
    { owner: "example", repo: "alpha" },
    { owner: "example", repo: "beta" },
  ]);
});

test("extracts repositories from GitHub URLs with trailing slashes", () => {
  const readme = featuredProjectsReadme.replace(
    "https://github.com/example/alpha)",
    "https://github.com/example/alpha/)",
  );

  assert.deepEqual(extractProjects(readme), [
    { owner: "example", repo: "alpha" },
    { owner: "example", repo: "beta" },
  ]);
});

test("replaces only Featured Projects star cells", () => {
  assert.equal(
    replaceStarCounts(
      featuredProjectsReadme,
      new Map([
        ["example/alpha", 7],
        ["example/beta", 24],
      ]),
    ),
    `Before
## 🚀 Featured Projects

| Project | Description | Stars |
|---------|-------------|:-----:|
| [alpha](https://github.com/example/alpha) | First project | ⭐ 7 |
| [beta](https://github.com/example/beta) | Second project | ⭐ 24 |

---
After`,
  );
});

test("throws when the Featured Projects table is missing", () => {
  assert.throws(
    () => extractProjects("# Profile"),
    /Featured Projects table was not found/,
  );
});

test("throws when a Featured Projects table contains malformed data rows", () => {
  const readme = featuredProjectsReadme.replace(
    "https://github.com/example/beta",
    "https://gitlab.com/example/beta",
  );

  assert.throws(
    () => extractProjects(readme),
    /Featured Projects table contains malformed repository rows/,
  );
});

test("uses a distinct error when the table contains no repository rows", () => {
  const readme = `## 🚀 Featured Projects

| Project | Description | Stars |
|---------|-------------|:-----:|

---`;

  assert.throws(
    () => extractProjects(readme),
    /Featured Projects table contains no repository rows/,
  );
});

test("does not change lookalike project rows outside Featured Projects", () => {
  const readme = `${featuredProjectsReadme}
| [alpha](https://github.com/example/alpha) | Outside section | ⭐ 1 |`;

  const updated = replaceStarCounts(
    readme,
    new Map([
      ["example/alpha", 7],
      ["example/beta", 24],
    ]),
  );

  assert.match(
    updated,
    /\| \[alpha\]\(https:\/\/github\.com\/example\/alpha\) \| Outside section \| ⭐ 1 \|$/,
  );
});

test("throws when a required project star count is missing", () => {
  assert.throws(
    () =>
      replaceStarCounts(
        featuredProjectsReadme,
        new Map([["example/alpha", 7]]),
      ),
    /Missing star count for example\/beta/,
  );
});
