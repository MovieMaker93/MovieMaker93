import { readFile, writeFile } from "node:fs/promises";

const README_PATH = new URL("../README.md", import.meta.url);
const SECTION_HEADING = "## 🚀 Featured Projects";
const MINIMUM_RATE_LIMIT_DELAY_MS = 60_000;
const PROJECT_CELL =
  /^\[[^\]]+\]\(https:\/\/github\.com\/([^/\s)]+)\/([^/\s)]+)\/?\)$/;

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

function tableCells(line) {
  let content = line.trim();
  if (!content || !content.includes("|")) {
    return null;
  }
  if (content.startsWith("|")) {
    content = content.slice(1);
  }
  if (content.endsWith("|")) {
    content = content.slice(0, -1);
  }

  const cells = content.split("|").map((cell) => cell.trim());
  return cells.length === 3 && cells.every(Boolean) ? cells : null;
}

function isHeader(cells) {
  return (
    cells?.[0] === "Project" &&
    cells[1] === "Description" &&
    cells[2] === "Stars"
  );
}

function isSeparator(cells) {
  return (
    cells?.length === 3 &&
    cells.every((cell) => /^:?-{3,}:?$/.test(cell))
  );
}

function projectRow(line, index) {
  const cells = tableCells(line);
  const project = cells?.[0].match(PROJECT_CELL);
  const stars = cells?.[2].match(/^⭐\s+(\d+)$/);
  if (!project || !stars) {
    return null;
  }

  return {
    index,
    line,
    owner: project[1],
    repo: project[2],
  };
}

function featuredProjectsTable(content) {
  const lines = content.split("\n");
  const headerIndex = lines.findIndex((line) => isHeader(tableCells(line)));
  if (headerIndex === -1 || !isSeparator(tableCells(lines[headerIndex + 1]))) {
    throw new Error("Featured Projects table was not found");
  }

  const rows = [];
  for (let index = headerIndex + 2; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) {
      break;
    }

    const row = projectRow(line, index);
    if (!row) {
      throw new Error("Featured Projects table contains malformed repository rows");
    }
    rows.push(row);
  }

  if (rows.length === 0) {
    throw new Error("Featured Projects table contains no repository rows");
  }

  return { lines, rows };
}

export function extractProjects(readme) {
  const { content } = featuredProjectsSection(readme);

  return featuredProjectsTable(content).rows.map(({ owner, repo }) => ({
    owner,
    repo,
  }));
}

export function replaceStarCounts(readme, counts) {
  const { content, start, end } = featuredProjectsSection(readme);
  const { lines, rows } = featuredProjectsTable(content);
  for (const { index, line, owner, repo } of rows) {
    const project = `${owner}/${repo}`;
    if (!counts.has(project)) {
      throw new Error(`Missing star count for ${project}`);
    }

    lines[index] = line.replace(
      /(⭐\s*)\d+(\s*\|?\s*)$/,
      `$1${counts.get(project)}$2`,
    );
  }
  const updatedContent = lines.join("\n");

  return `${readme.slice(0, start)}${updatedContent}${readme.slice(end)}`;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function isRateLimitedResponse(response) {
  if (response.status === 429) {
    return true;
  }
  if (response.status !== 403) {
    return false;
  }
  if (
    response.headers.get("x-ratelimit-remaining") === "0" ||
    response.headers.has("retry-after")
  ) {
    return true;
  }

  try {
    const body = await response.clone().text();
    return /secondary rate limit|api rate limit exceeded/i.test(body);
  } catch {
    return false;
  }
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

  return Math.max(fallbackDelay, MINIMUM_RATE_LIMIT_DELAY_MS);
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
        const isRateLimited = await isRateLimitedResponse(response);
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
            ? rateLimitDelay(
                response,
                Math.max(
                  fallbackDelay,
                  MINIMUM_RATE_LIMIT_DELAY_MS * 2 ** (attempt - 1),
                ),
                nowImpl,
              )
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

export async function updateProjectStars({
  fetchStarCountImpl = fetchStarCount,
  logImpl = console.log,
  readFileImpl = readFile,
  readmePath = README_PATH,
  writeFileImpl = writeFile,
} = {}) {
  const readme = await readFileImpl(readmePath, "utf8");
  const projects = extractProjects(readme);
  const counts = new Map();

  for (const { owner, repo } of projects) {
    counts.set(`${owner}/${repo}`, await fetchStarCountImpl(owner, repo));
  }

  const updatedReadme = replaceStarCounts(readme, counts);
  if (updatedReadme === readme) {
    logImpl("Featured project stars are already up to date");
    return false;
  }

  await writeFileImpl(readmePath, updatedReadme);
  logImpl(`Updated star counts for ${projects.length} featured projects`);
  return true;
}

async function main() {
  await updateProjectStars();
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  await main();
}
