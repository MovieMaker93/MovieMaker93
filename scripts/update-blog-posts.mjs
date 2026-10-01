import { readFile, writeFile } from "node:fs/promises";

const RSS_URL = "https://alfonsofortunato.com/rss.xml";
const README_PATH = new URL("../README.md", import.meta.url);
const START_MARKER = "<!-- BLOG-POST-LIST:START -->";
const END_MARKER = "<!-- BLOG-POST-LIST:END -->";
const MAX_POSTS = 5;

export function decodeHtmlEntities(value) {
  const namedEntities = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    quot: '"',
  };

  return value.replace(
    /&(#(?:x[\da-f]+|\d+)|[a-z]+);/gi,
    (entity, code) => {
      if (code.startsWith("#x") || code.startsWith("#X")) {
        return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
      }
      if (code.startsWith("#")) {
        return String.fromCodePoint(Number.parseInt(code.slice(1), 10));
      }
      return namedEntities[code.toLowerCase()] ?? entity;
    },
  );
}

export function latestBlogUrls(rss, limit = MAX_POSTS) {
  return [...rss.matchAll(/<item>([\s\S]*?)<\/item>/g)]
    .map(([, entry]) => ({
      title: decodeHtmlEntities(entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "").trim(),
      url: entry.match(/<link>(.*?)<\/link>/)?.[1],
      published: Date.parse(entry.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? ""),
    }))
    .filter(({ title, url, published }) => {
      if (!title || !url || !Number.isFinite(published)) return false;
      const path = new URL(url).pathname.replace(/\/$/, "");
      return path.startsWith("/blog/") && path !== "/blog";
    })
    .sort((a, b) => b.published - a.published)
    .slice(0, limit);
}

export function replaceBlogList(readme, posts) {
  const startCount = readme.split(START_MARKER).length - 1;
  const endCount = readme.split(END_MARKER).length - 1;
  if (startCount !== 1 || endCount !== 1) {
    throw new Error("README must contain exactly one blog marker pair");
  }

  const list = posts
    .map(({ title, url }) => {
      const safeTitle = title.replaceAll("[", "\\[").replaceAll("]", "\\]");
      return `- [${safeTitle}](${url})`;
    })
    .join("\n");

  const pattern = new RegExp(
    `${START_MARKER}[\\s\\S]*?${END_MARKER}`,
  );
  return readme.replace(
    pattern,
    `${START_MARKER}\n${list}\n${END_MARKER}`,
  );
}

export async function fetchText(
  url,
  {
    attempts = 3,
    fetchImpl = fetch,
    retryDelayMs = 1_000,
  } = {},
) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        headers: { "user-agent": "MovieMaker93-profile-readme-updater" },
        redirect: "follow",
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        throw new Error(`${url} returned HTTP ${response.status}`);
      }
      return await response.text();
    } catch (error) {
      if (attempt === attempts) {
        throw error;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, retryDelayMs * attempt),
      );
    }
  }

  throw new Error(`Failed to fetch ${url}`);
}

async function main() {
  const rss = await fetchText(RSS_URL);
  const posts = latestBlogUrls(rss);
  if (posts.length === 0) {
    throw new Error("No blog posts found in the RSS feed");
  }

  const readme = await readFile(README_PATH, "utf8");
  const updatedReadme = replaceBlogList(readme, posts);
  if (updatedReadme === readme) {
    console.log("README is already up to date");
    return;
  }

  await writeFile(README_PATH, updatedReadme);
  console.log(`Updated README with ${posts.length} blog posts`);
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  await main();
}
