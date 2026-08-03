import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("練習頁與查題頁都有可存下完整題目上下文的回報入口", async () => {
  const [index, check, app, checker, client, styles] = await Promise.all([
    read("index.html"),
    read("check.html"),
    read("app.js"),
    read("check.js"),
    read("report-client.js"),
    read("styles.css"),
  ]);

  assert.match(index, /report-client\.js\?v=20260803-report/);
  assert.match(check, /report-client\.js\?v=20260803-report/);
  assert.match(app, /report-question-btn/);
  assert.match(app, /TvetReport\.openQuestion/);
  assert.match(checker, /report-question-btn/);
  assert.match(checker, /TvetReport\.openQuestion/);
  for (const field of ["prompt", "options", "answer", "explanation", "source"]) {
    assert.match(`${app}\n${checker}`, new RegExp(`${field}:`));
  }
  assert.match(client, /setAttribute\("aria-labelledby", "reportTitle"\)/);
  assert.match(client, /回報網站問題/);
  assert.match(client, /https:\/\/tvet-english\.vercel\.app\/api\/report/);
  assert.match(styles, /\.report-dialog/);
  assert.match(styles, /\.report-question-btn/);
});
