import assert from "node:assert/strict";
import test from "node:test";

import {
  latestBlogUrls,
  replaceBlogList,
  titleFromHtml,
} from "../scripts/update-blog-posts.mjs";

test("selects only the newest blog URLs from a sitemap", () => {
  const sitemap = `
    <urlset>
      <url><loc>https://example.com/blog</loc></url>
      <url><loc>https://example.com/blog/older</loc><lastmod>2025-01-01</lastmod></url>
      <url><loc>https://example.com/about</loc><lastmod>2026-01-01</lastmod></url>
      <url><loc>https://example.com/blog/newer</loc><lastmod>2026-01-01</lastmod></url>
    </urlset>`;

  assert.deepEqual(
    latestBlogUrls(sitemap).map(({ url }) => url),
    [
      "https://example.com/blog/newer",
      "https://example.com/blog/older",
    ],
  );
});

test("extracts and cleans the Open Graph title", () => {
  const html =
    '<meta property="og:title" content="Cloud &amp; Kubernetes | Alfonso Fortunato">';

  assert.equal(titleFromHtml(html), "Cloud & Kubernetes");
});

test("replaces only the content inside the blog markers", () => {
  const readme = `Before
<!-- BLOG-POST-LIST:START -->
- old
<!-- BLOG-POST-LIST:END -->
After`;

  assert.equal(
    replaceBlogList(readme, [
      { title: "A [new] post", url: "https://example.com/blog/new" },
    ]),
    `Before
<!-- BLOG-POST-LIST:START -->
- [A \\[new\\] post](https://example.com/blog/new)
<!-- BLOG-POST-LIST:END -->
After`,
  );
});
