import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchText,
  latestBlogUrls,
  replaceBlogList,
} from "../scripts/update-blog-posts.mjs";

test("selects the newest articles and decodes their RSS titles", () => {
  const rss = `
    <rss><channel>
      <item><title>Older article</title><link>https://example.com/blog/older/</link><pubDate>Wed, 01 Jan 2025 00:00:00 GMT</pubDate></item>
      <item><title>About page</title><link>https://example.com/about/</link><pubDate>Thu, 01 Jan 2026 00:00:00 GMT</pubDate></item>
      <item><title>Newer &#39;article&#39;</title><link>https://example.com/blog/newer/</link><pubDate>Thu, 01 Jan 2026 00:00:00 GMT</pubDate></item>
    </channel></rss>`;

  assert.deepEqual(
    latestBlogUrls(rss, 2).map(({ title, url }) => ({ title, url })),
    [
      { title: "Newer 'article'", url: "https://example.com/blog/newer/" },
      { title: "Older article", url: "https://example.com/blog/older/" },
    ],
  );
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

test("retries transient network failures", async () => {
  let attempts = 0;
  const fetchImpl = async () => {
    attempts += 1;
    if (attempts < 3) {
      throw new Error("read ECONNRESET");
    }
    return new Response("ok");
  };

  assert.equal(
    await fetchText("https://example.com", {
      attempts: 3,
      fetchImpl,
      retryDelayMs: 0,
    }),
    "ok",
  );
  assert.equal(attempts, 3);
});
