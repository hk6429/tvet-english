import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("首頁載入共用三欄人數統計元件並使用正確站點 ID", () => {
  assert.match(html, /src="https:\/\/self-learning-orbit\.pages\.dev\/exam-counter\.js\?v=20260803-1"/);
  assert.match(html, /data-site="tvet-english"/);
  assert.doesNotMatch(html, /id="gc-visitors"|goatcounter/i);
});
