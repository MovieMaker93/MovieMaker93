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
