import { readFile, writeFile } from "node:fs/promises";

const README_PATH = new URL("../README.md", import.meta.url);
const SECTION_HEADING = "## 🚀 Featured Projects";
const PROJECT_ROW =
  /^\| \[[^\]]+\]\(https:\/\/github\.com\/([^/\s)]+)\/([^/\s)]+)\/?\) \|.*\| ⭐ (\d+) \|$/gm;

function featuredProjectsSection(readme) {
  const sectionStart = readme.indexOf(SECTION_HEADING);
  if (sectionStart === -1) {
    throw new Error("Featured Projects table was not found");
  }

  const sectionEnd = readme.indexOf("\n---", sectionStart);
  if (sectionEnd === -1) {
    throw new Error("Featured Projects table separator was not found");
  }

  return {
    content: readme.slice(sectionStart, sectionEnd),
    start: sectionStart,
    end: sectionEnd,
  };
}

function projectRows(content) {
  const rows = content
    .split("\n")
    .filter((line) => line.startsWith("|"))
    .filter((line) => !/^\| Project \| Description \| Stars \|$/.test(line))
    .filter((line) => !/^\|[-:| ]+\|$/.test(line));

  const matches = rows.map((row) => row.match(new RegExp(PROJECT_ROW.source)));
  if (matches.every((match) => match === null)) {
    throw new Error("Featured Projects table contains no repository rows");
  }
  if (matches.some((match) => match === null)) {
    throw new Error("Featured Projects table contains malformed repository rows");
  }

  return matches;
}

export function extractProjects(readme) {
  const { content } = featuredProjectsSection(readme);

  return projectRows(content).map(([, owner, repo]) => ({ owner, repo }));
}

export function replaceStarCounts(readme, counts) {
  const { content, start, end } = featuredProjectsSection(readme);
  projectRows(content);
  const updatedContent = content.replace(
    PROJECT_ROW,
    (row, owner, repo) => {
      const project = `${owner}/${repo}`;
      if (!counts.has(project)) {
        throw new Error(`Missing star count for ${project}`);
      }

      return row.replace(/⭐ \d+ \|$/, `⭐ ${counts.get(project)} |`);
    },
  );

  return `${readme.slice(0, start)}${updatedContent}${readme.slice(end)}`;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isRateLimitedResponse(response) {
  return (
    response.status === 429 ||
    (response.status === 403 &&
      (response.headers.get("x-ratelimit-remaining") === "0" ||
        response.headers.has("retry-after")))
  );
}

function rateLimitDelay(response, fallbackDelay, now) {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter !== null) {
    const retryAfterSeconds = Number(retryAfter);
    if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
      return retryAfterSeconds * 1_000;
    }
  }

  const reset = response.headers.get("x-ratelimit-reset");
  if (reset !== null) {
    const resetSeconds = Number(reset);
    const resetDelay = resetSeconds * 1_000 - now();
    if (Number.isFinite(resetSeconds) && resetDelay > 0) {
      return resetDelay;
    }
  }

  return fallbackDelay;
}

export async function fetchStarCount(
  owner,
  repo,
  {
    attempts = 3,
    fetchImpl = fetch,
    retryDelayMs = 1_000,
    token = process.env.GITHUB_TOKEN,
    waitImpl = delay,
    nowImpl = Date.now,
  } = {},
) {
  const url = `https://api.github.com/repos/${owner}/${repo}`;
  const headers = {
    accept: "application/vnd.github+json",
    "user-agent": "MovieMaker93-profile-readme-updater",
    "x-github-api-version": "2022-11-28",
  };
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        headers,
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        const error = new Error(`${url} returned HTTP ${response.status}`);
        const isRateLimited = isRateLimitedResponse(response);
        const isRetryable = isRateLimited || response.status >= 500;
        if (!isRetryable) {
          error.nonRetryable = true;
          throw error;
        }
        if (attempt === attempts) {
          throw error;
        }
        const fallbackDelay = retryDelayMs * attempt;
        await waitImpl(
          isRateLimited
            ? rateLimitDelay(response, fallbackDelay, nowImpl)
            : fallbackDelay,
        );
        continue;
      }

      let payload;
      try {
        payload = await response.json();
      } catch (error) {
        error.nonRetryable = true;
        throw error;
      }
      if (
        !Number.isSafeInteger(payload?.stargazers_count) ||
        payload.stargazers_count < 0
      ) {
        const error = new Error(`${url} returned invalid stargazers_count`);
        error.nonRetryable = true;
        throw error;
      }

      return payload.stargazers_count;
    } catch (error) {
      if (error?.nonRetryable || attempt === attempts) {
        throw error;
      }
      await waitImpl(retryDelayMs * attempt);
    }
  }

  throw new Error(`Failed to fetch ${url}`);
}

async function main() {
  const readme = await readFile(README_PATH, "utf8");
  const projects = extractProjects(readme);
  const counts = new Map();

  for (const { owner, repo } of projects) {
    counts.set(`${owner}/${repo}`, await fetchStarCount(owner, repo));
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
