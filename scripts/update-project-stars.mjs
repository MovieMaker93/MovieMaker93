import { readFile, writeFile } from "node:fs/promises";

const README_PATH = new URL("../README.md", import.meta.url);
const SECTION_HEADING = "## 🚀 Featured Projects";
const PROJECT_ROW =
  /^\| \[[^\]]+\]\(https:\/\/github\.com\/([^/\s)]+)\/([^/\s)]+)\) \|.*\| ⭐ (\d+) \|$/gm;

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

export function extractProjects(readme) {
  const { content } = featuredProjectsSection(readme);
  const projects = [...content.matchAll(PROJECT_ROW)].map(([, owner, repo]) => ({
    owner,
    repo,
  }));

  if (projects.length === 0) {
    throw new Error("Featured Projects table was not found");
  }

  return projects;
}

export function replaceStarCounts(readme, counts) {
  const { content, start, end } = featuredProjectsSection(readme);
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
