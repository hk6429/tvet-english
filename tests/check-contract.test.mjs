import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../check.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../check.js", import.meta.url), "utf8");

test("查題頁支援 Enter、網址題號、焦點與官方選項統計", () => {
  assert.match(html, /<form id="checkForm"/);
  assert.match(html, /type="submit"/);
  assert.match(html, /id="checkError"[^>]*role="alert"/);
  assert.match(script, /requestedNo/);
  assert.match(script, /showAnswer\(\)/);
  assert.match(script, /OFFICIAL_OPTION_STATS_115/);
  assert.match(script, /result\.focus/);
});
