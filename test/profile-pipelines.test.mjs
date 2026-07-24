import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
const activityWorkflow = await readFile(
  new URL("../.github/workflows/update-readme.yml", import.meta.url),
  "utf8",
);
const blogWorkflow = await readFile(
  new URL("../.github/workflows/blog-post-workflow.yml", import.meta.url),
  "utf8",
);

test("README links to the requested X account", () => {
  assert.match(readme, /\(https:\/\/x\.com\/devopsfortunato\)/);
});

test("activity updater has exactly one ordered marker pair", () => {
  const start = "<!--START_SECTION:activity-->";
  const end = "<!--END_SECTION:activity-->";

  assert.equal(readme.split(start).length - 1, 1);
  assert.equal(readme.split(end).length - 1, 1);
  assert.ok(readme.indexOf(start) < readme.indexOf(end));
  assert.match(activityWorkflow, /github-activity-readme/);
});

test("blog updater uses the sitemap-backed local script", () => {
  assert.match(blogWorkflow, /node scripts\/update-blog-posts\.mjs/);
  assert.doesNotMatch(blogWorkflow, /alfonsofortunato\.com\/index\.xml/);
});
