import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("首頁公開顯示各平台獨立的到站人數，無資料時仍顯示 0", () => {
  const counter = html.match(/<a id="gc-visitors"[\s\S]*?<\/a>/)?.[0] ?? "";
  assert.match(counter, /👣 到站\s*<span id="gc-visitors-n">0<\/span>/);
  assert.doesNotMatch(counter, /display\s*:\s*none/);
  assert.match(html, /encodeURIComponent\(location\.host\s*\+\s*["']\/["']\)/);
  assert.match(html, /window\.goatcounter\s*=\s*\{\s*path:\s*p\s*=>\s*location\.host\s*\+\s*p\s*\}/);
  assert.match(html, /data-goatcounter="https:\/\/hk6429\.goatcounter\.com\/count"/);
});
