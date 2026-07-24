import assert from "node:assert/strict";
import test from "node:test";

import {
  extractProjects,
  fetchStarCount,
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
