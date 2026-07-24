import { readFile, writeFile } from "node:fs/promises";

const SITEMAP_URL = "https://alfonsofortunato.com/sitemap.xml";
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

export function latestBlogUrls(sitemap, limit = MAX_POSTS) {
  return [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)]
    .map(([, entry]) => ({
      url: entry.match(/<loc>(.*?)<\/loc>/)?.[1],
      lastModified: entry.match(/<lastmod>(.*?)<\/lastmod>/)?.[1] ?? "",
    }))
    .filter(({ url }) => {
      if (!url) return false;
      const path = new URL(url).pathname.replace(/\/$/, "");
      return path.startsWith("/blog/") && path !== "/blog";
    })
    .sort((a, b) => b.lastModified.localeCompare(a.lastModified))
    .slice(0, limit);
}

export function titleFromHtml(html) {
  const rawTitle =
    html.match(
      /<meta\s+property=["']og:title["']\s+content=["']([^"']+)["'][^>]*>/i,
    )?.[1] ?? html.match(/<title>(.*?)<\/title>/is)?.[1];

  if (!rawTitle) {
    throw new Error("Blog post page does not contain a title");
  }

  return decodeHtmlEntities(rawTitle)
    .replace(/\s+\|\s+Alfonso Fortunato\s*$/, "")
    .trim();
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
  const sitemap = await fetchText(SITEMAP_URL);
  const entries = latestBlogUrls(sitemap);
  if (entries.length === 0) {
    throw new Error("No blog posts found in the sitemap");
  }

  const posts = [];
  for (const { url } of entries) {
    posts.push({
      title: titleFromHtml(await fetchText(url)),
      url: new URL(url).href,
    });
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
