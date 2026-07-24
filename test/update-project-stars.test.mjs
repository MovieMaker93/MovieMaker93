import assert from "node:assert/strict";
import test from "node:test";

import {
  extractProjects,
  fetchStarCount,
  replaceStarCounts,
  updateProjectStars,
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

test("extracts and updates every row in an indented table without outer pipes", () => {
  const readme = `## 🚀 Featured Projects

  Project | Description | Stars
  ------- | ----------- | :----:
  [alpha](https://github.com/example/alpha) | First project | ⭐ 1
  [beta](https://github.com/example/beta) | Second project | ⭐ 20

---`;

  assert.deepEqual(extractProjects(readme), [
    { owner: "example", repo: "alpha" },
    { owner: "example", repo: "beta" },
  ]);
  assert.equal(
    replaceStarCounts(
      readme,
      new Map([
        ["example/alpha", 7],
        ["example/beta", 24],
      ]),
    ),
    readme
      .replace("⭐ 1", "⭐ 7")
      .replace("⭐ 20", "⭐ 24"),
  );
});

test("updates every row in a table with mixed outer-pipe formatting", () => {
  const readme = `## 🚀 Featured Projects

| Project | Description | Stars |
|---------|-------------|:-----:|
  | [alpha](https://github.com/example/alpha) | First project | ⭐ 1 |
  [beta](https://github.com/example/beta) | Second project | ⭐ 20

---`;

  assert.deepEqual(extractProjects(readme), [
    { owner: "example", repo: "alpha" },
    { owner: "example", repo: "beta" },
  ]);
  assert.equal(
    replaceStarCounts(
      readme,
      new Map([
        ["example/alpha", 7],
        ["example/beta", 24],
      ]),
    ),
    readme
      .replace("⭐ 1", "⭐ 7")
      .replace("⭐ 20", "⭐ 24"),
  );
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

test("does not replace a star count in a project description", () => {
  const readme = featuredProjectsReadme.replace(
    "First project",
    "First project has ⭐ 99",
  );

  assert.equal(
    replaceStarCounts(
      readme,
      new Map([
        ["example/alpha", 7],
        ["example/beta", 24],
      ]),
    ),
    readme.replace("⭐ 1 |", "⭐ 7 |").replace("⭐ 20 |", "⭐ 24 |"),
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

test("fails closed when a pipe-less table data row is malformed", () => {
  const readme = featuredProjectsReadme.replace(
    "| [beta](https://github.com/example/beta) | Second project | ⭐ 20 |",
    "[beta](https://gitlab.com/example/beta) | Second project | ⭐ 20",
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

test("fetches a repository's star count from GitHub", async () => {
  const requests = [];
  const stars = await fetchStarCount("example", "alpha", {
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      return new Response(JSON.stringify({ stargazers_count: 42 }));
    },
    retryDelayMs: 0,
  });

  assert.equal(stars, 42);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://api.github.com/repos/example/alpha");
  assert.equal(requests[0].init.headers.accept, "application/vnd.github+json");
  assert.equal(
    requests[0].init.headers["user-agent"],
    "MovieMaker93-profile-readme-updater",
  );
  assert.equal(requests[0].init.headers["x-github-api-version"], "2022-11-28");
});

test("sends Authorization when a GitHub token is supplied", async () => {
  const requests = [];

  await fetchStarCount("example", "alpha", {
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      return new Response(JSON.stringify({ stargazers_count: 42 }));
    },
    token: "test-token",
  });

  assert.equal(requests[0].init.headers.authorization, "Bearer test-token");
});

test("omits Authorization when no GitHub token is supplied", async () => {
  const requests = [];

  await fetchStarCount("example", "alpha", {
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      return new Response(JSON.stringify({ stargazers_count: 42 }));
    },
    token: "",
  });

  assert.equal(Object.hasOwn(requests[0].init.headers, "authorization"), false);
});

test("rejects malformed star-count payloads without retrying", async () => {
  let attempts = 0;

  await assert.rejects(
    fetchStarCount("example", "alpha", {
      fetchImpl: async () => {
        attempts += 1;
        return new Response(JSON.stringify({ stargazers_count: "many" }));
      },
      retryDelayMs: 0,
    }),
    /invalid stargazers_count/,
  );

  assert.equal(attempts, 1);
});

test("rejects malformed GitHub JSON without retrying", async () => {
  let attempts = 0;

  await assert.rejects(
    fetchStarCount("example", "alpha", {
      fetchImpl: async () => {
        attempts += 1;
        return new Response("not JSON");
      },
      retryDelayMs: 0,
    }),
    SyntaxError,
  );

  assert.equal(attempts, 1);
});

test("retries transient network failures before fetching a star count", async () => {
  let attempts = 0;
  const stars = await fetchStarCount("example", "alpha", {
    fetchImpl: async () => {
      attempts += 1;
      if (attempts < 3) {
        const error = new Error("connection reset");
        error.code = "ECONNRESET";
        throw error;
      }
      return new Response(JSON.stringify({ stargazers_count: 42 }));
    },
    retryDelayMs: 0,
  });

  assert.equal(stars, 42);
  assert.equal(attempts, 3);
});

test("does not retry non-retryable GitHub HTTP errors", async () => {
  let attempts = 0;

  await assert.rejects(
    fetchStarCount("example", "missing", {
      fetchImpl: async () => {
        attempts += 1;
        return new Response("Not found", { status: 404 });
      },
      retryDelayMs: 0,
    }),
    /HTTP 404/,
  );

  assert.equal(attempts, 1);
});

test("retries retryable GitHub server errors", async () => {
  let attempts = 0;
  const stars = await fetchStarCount("example", "alpha", {
    fetchImpl: async () => {
      attempts += 1;
      if (attempts < 3) {
        return new Response("Server error", { status: 500 });
      }
      return new Response(JSON.stringify({ stargazers_count: 42 }));
    },
    retryDelayMs: 0,
  });

  assert.equal(stars, 42);
  assert.equal(attempts, 3);
});

test("retries GitHub rate limits before fetching a star count", async () => {
  let attempts = 0;
  const stars = await fetchStarCount("example", "alpha", {
    fetchImpl: async () => {
      attempts += 1;
      if (attempts < 3) {
        return new Response("Rate limited", { status: 429 });
      }
      return new Response(JSON.stringify({ stargazers_count: 42 }));
    },
    retryDelayMs: 0,
    waitImpl: async () => {},
  });

  assert.equal(stars, 42);
  assert.equal(attempts, 3);
});

test("does not retry ordinary GitHub forbidden responses", async () => {
  let attempts = 0;

  await assert.rejects(
    fetchStarCount("example", "forbidden", {
      fetchImpl: async () => {
        attempts += 1;
        return new Response("Forbidden", { status: 403 });
      },
      retryDelayMs: 0,
    }),
    /HTTP 403/,
  );

  assert.equal(attempts, 1);
});

test("retries GitHub rate-limited forbidden responses", async () => {
  let attempts = 0;
  const waits = [];
  const stars = await fetchStarCount("example", "alpha", {
    fetchImpl: async () => {
      attempts += 1;
      if (attempts === 1) {
        return new Response("Rate limited", {
          headers: { "x-ratelimit-remaining": "0" },
          status: 403,
        });
      }
      return new Response(JSON.stringify({ stargazers_count: 42 }));
    },
    retryDelayMs: 0,
    waitImpl: async (milliseconds) => waits.push(milliseconds),
  });

  assert.equal(stars, 42);
  assert.equal(attempts, 2);
  assert.deepEqual(waits, [60_000]);
});

test("retries message-only secondary GitHub rate limits", async () => {
  let attempts = 0;
  const waits = [];
  const stars = await fetchStarCount("example", "alpha", {
    fetchImpl: async () => {
      attempts += 1;
      if (attempts === 1) {
        return new Response(
          JSON.stringify({
            message: "You have exceeded a secondary rate limit.",
          }),
          { status: 403 },
        );
      }
      return new Response(JSON.stringify({ stargazers_count: 42 }));
    },
    retryDelayMs: 0,
    waitImpl: async (milliseconds) => waits.push(milliseconds),
  });

  assert.equal(stars, 42);
  assert.equal(attempts, 2);
  assert.deepEqual(waits, [60_000]);
});

test("uses a minimum delay for headerless GitHub rate limits", async () => {
  let attempts = 0;
  const waits = [];
  const stars = await fetchStarCount("example", "alpha", {
    fetchImpl: async () => {
      attempts += 1;
      if (attempts === 1) {
        return new Response("Rate limited", { status: 429 });
      }
      return new Response(JSON.stringify({ stargazers_count: 42 }));
    },
    retryDelayMs: 1_000,
    waitImpl: async (milliseconds) => waits.push(milliseconds),
  });

  assert.equal(stars, 42);
  assert.deepEqual(waits, [60_000]);
});

test("increases fallback waits for repeated headerless GitHub rate limits", async () => {
  let attempts = 0;
  const waits = [];

  await assert.rejects(
    fetchStarCount("example", "alpha", {
      attempts: 3,
      fetchImpl: async () => {
        attempts += 1;
        return new Response("Rate limited", { status: 429 });
      },
      retryDelayMs: 1,
      waitImpl: async (milliseconds) => waits.push(milliseconds),
    }),
    /HTTP 429/,
  );

  assert.equal(attempts, 3);
  assert.deepEqual(waits, [60_000, 120_000]);
});

test("uses Retry-After to delay retryable GitHub responses", async () => {
  let attempts = 0;
  const waits = [];
  const stars = await fetchStarCount("example", "alpha", {
    fetchImpl: async () => {
      attempts += 1;
      if (attempts === 1) {
        return new Response("Rate limited", {
          headers: { "retry-after": "7" },
          status: 429,
        });
      }
      return new Response(JSON.stringify({ stargazers_count: 42 }));
    },
    retryDelayMs: 1,
    waitImpl: async (milliseconds) => waits.push(milliseconds),
  });

  assert.equal(stars, 42);
  assert.deepEqual(waits, [7_000]);
});

test("prefers Retry-After over X-RateLimit-Reset", async () => {
  let attempts = 0;
  const waits = [];
  const stars = await fetchStarCount("example", "alpha", {
    fetchImpl: async () => {
      attempts += 1;
      if (attempts === 1) {
        return new Response("Rate limited", {
          headers: {
            "retry-after": "7",
            "x-ratelimit-reset": "105",
          },
          status: 429,
        });
      }
      return new Response(JSON.stringify({ stargazers_count: 42 }));
    },
    nowImpl: () => 100_000,
    waitImpl: async (milliseconds) => waits.push(milliseconds),
  });

  assert.equal(stars, 42);
  assert.deepEqual(waits, [7_000]);
});

test("uses X-RateLimit-Reset to delay retryable GitHub responses", async () => {
  let attempts = 0;
  const waits = [];
  const stars = await fetchStarCount("example", "alpha", {
    fetchImpl: async () => {
      attempts += 1;
      if (attempts === 1) {
        return new Response("Rate limited", {
          headers: { "x-ratelimit-reset": "105" },
          status: 429,
        });
      }
      return new Response(JSON.stringify({ stargazers_count: 42 }));
    },
    nowImpl: () => 100_000,
    retryDelayMs: 1,
    waitImpl: async (milliseconds) => waits.push(milliseconds),
  });

  assert.equal(stars, 42);
  assert.deepEqual(waits, [5_000]);
});

test("rejects negative GitHub star counts", async () => {
  let attempts = 0;

  await assert.rejects(
    fetchStarCount("example", "alpha", {
      fetchImpl: async () => {
        attempts += 1;
        return new Response(JSON.stringify({ stargazers_count: -1 }));
      },
      retryDelayMs: 0,
    }),
    /invalid stargazers_count/,
  );

  assert.equal(attempts, 1);
});

test("rejects after exhausting transient network retries", async () => {
  let attempts = 0;
  const waits = [];

  await assert.rejects(
    fetchStarCount("example", "alpha", {
      attempts: 2,
      fetchImpl: async () => {
        attempts += 1;
        throw new Error("connection reset");
      },
      retryDelayMs: 123,
      waitImpl: async (milliseconds) => waits.push(milliseconds),
    }),
    /connection reset/,
  );

  assert.equal(attempts, 2);
  assert.deepEqual(waits, [123]);
});

test("rejects after exhausting retryable GitHub server errors", async () => {
  let attempts = 0;
  const waits = [];

  await assert.rejects(
    fetchStarCount("example", "alpha", {
      attempts: 2,
      fetchImpl: async () => {
        attempts += 1;
        return new Response("Server error", { status: 503 });
      },
      retryDelayMs: 123,
      waitImpl: async (milliseconds) => waits.push(milliseconds),
    }),
    /HTTP 503/,
  );

  assert.equal(attempts, 2);
  assert.deepEqual(waits, [123]);
});

test("rejects after exhausting GitHub rate-limit retries", async () => {
  let attempts = 0;
  const waits = [];

  await assert.rejects(
    fetchStarCount("example", "alpha", {
      attempts: 2,
      fetchImpl: async () => {
        attempts += 1;
        return new Response("Rate limited", { status: 429 });
      },
      waitImpl: async (milliseconds) => waits.push(milliseconds),
    }),
    /HTTP 429/,
  );

  assert.equal(attempts, 2);
  assert.deepEqual(waits, [60_000]);
});

test("fetches featured projects sequentially before writing the README", async () => {
  const calls = [];
  const writes = [];
  let releaseAlpha;
  const alphaGate = new Promise((resolve) => {
    releaseAlpha = resolve;
  });

  const updating = updateProjectStars({
    readFileImpl: async () => featuredProjectsReadme,
    writeFileImpl: async (...args) => writes.push(args),
    fetchStarCountImpl: async (owner, repo) => {
      calls.push(`${owner}/${repo}`);
      if (repo === "alpha") {
        await alphaGate;
      }
      return repo === "alpha" ? 7 : 24;
    },
    logImpl: () => {},
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls, ["example/alpha"]);
  assert.deepEqual(writes, []);

  releaseAlpha();
  assert.equal(await updating, true);
  assert.deepEqual(calls, ["example/alpha", "example/beta"]);
  assert.equal(writes.length, 1);
});

test("does not write the README when a later project fetch fails", async () => {
  const writes = [];

  await assert.rejects(
    updateProjectStars({
      readFileImpl: async () => featuredProjectsReadme,
      writeFileImpl: async (...args) => writes.push(args),
      fetchStarCountImpl: async (_owner, repo) => {
        if (repo === "beta") {
          throw new Error("GitHub unavailable");
        }
        return 7;
      },
      logImpl: () => {},
    }),
    /GitHub unavailable/,
  );

  assert.deepEqual(writes, []);
});

test("returns false and logs exactly once when project star output is unchanged", async () => {
  const writes = [];
  const logs = [];

  const updated = await updateProjectStars({
    readFileImpl: async () => featuredProjectsReadme,
    writeFileImpl: async (...args) => writes.push(args),
    fetchStarCountImpl: async (_owner, repo) => (repo === "alpha" ? 1 : 20),
    logImpl: (message) => logs.push(message),
  });

  assert.equal(updated, false);
  assert.deepEqual(writes, []);
  assert.deepEqual(logs, ["Featured project stars are already up to date"]);
});

test("writes once after every project fetch succeeds with changed output", async () => {
  const events = [];
  const writes = [];
  const logs = [];

  const updated = await updateProjectStars({
    readFileImpl: async () => featuredProjectsReadme,
    writeFileImpl: async (...args) => {
      events.push("write");
      writes.push(args);
    },
    fetchStarCountImpl: async (owner, repo) => {
      events.push(`fetch:${owner}/${repo}`);
      return repo === "alpha" ? 7 : 24;
    },
    logImpl: (message) => logs.push(message),
  });

  assert.equal(updated, true);
  assert.deepEqual(events, [
    "fetch:example/alpha",
    "fetch:example/beta",
    "write",
  ]);
  assert.equal(writes.length, 1);
  assert.deepEqual(logs, ["Updated star counts for 2 featured projects"]);
});
