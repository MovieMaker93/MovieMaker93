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
