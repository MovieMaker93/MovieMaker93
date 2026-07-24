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

test("profile workflow runs each updater once before committing with a scoped token", () => {
  const blogCommand = "node scripts/update-blog-posts.mjs";
  const starStep = `      - name: Update featured project stars
        run: node scripts/update-project-stars.mjs
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}`;
  const commitStep = "      - name: Commit README";

  assert.match(blogWorkflow, /^  update-profile-content:/m);
  assert.equal(blogWorkflow.split(blogCommand).length - 1, 1);
  assert.equal(blogWorkflow.split("node scripts/update-project-stars.mjs").length - 1, 1);
  assert.equal(blogWorkflow.split("git commit").length - 1, 1);
  assert.equal(blogWorkflow.split("GITHUB_TOKEN:").length - 1, 1);
  assert.ok(blogWorkflow.indexOf(blogCommand) < blogWorkflow.indexOf(starStep));
  assert.ok(blogWorkflow.indexOf(starStep) < blogWorkflow.indexOf(commitStep));
  assert.equal(blogWorkflow.indexOf("GITHUB_TOKEN:"), blogWorkflow.indexOf(starStep) + starStep.indexOf("GITHUB_TOKEN:"));
});
