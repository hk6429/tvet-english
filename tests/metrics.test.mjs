import assert from "node:assert/strict";
import test from "node:test";
import { matchingNumbers, OFFICIAL_METRICS } from "../data/metrics.mjs";

test("115 年難度與鑑別度各完整覆蓋 42 題", () => {
  const items = Object.values(OFFICIAL_METRICS[115].items);
  assert.equal(items.length, 42);
  assert.equal(new Set(items.map((item) => item.difficulty)).size, 3);
  assert.equal(new Set(items.map((item) => item.discrimination)).size, 3);
  assert.ok(items.every((item) => item.difficulty && item.discrimination));
});

test("官方交叉表的極端與例示題號保持一致", () => {
  assert.deepEqual(matchingNumbers(115, "容易", "全部"), [2]);
  assert.deepEqual(matchingNumbers(115, "全部", "可"), [26]);
  assert.deepEqual(matchingNumbers(115, "全部", "佳"), [34]);
  assert.deepEqual(matchingNumbers(115, "困難", "優"), [3, 4, 6, 8, 21, 22, 27, 28, 32, 36, 40, 41]);
});
