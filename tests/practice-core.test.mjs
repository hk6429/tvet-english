import assert from "node:assert/strict";
import test from "node:test";
import { acceptedAnswers, clampQuestionCount, gradeItems, makeItems, makeItemsFromCandidates, mergeWrongBook } from "../practice-core.mjs";

const exam = { year: 115, questionCount: 8, answers: ["A", "B", "C", "D", "A", "B", "C", "D"], questionUrl: "https://example.test/115.pdf" };

test("題數會限制在 1 到該年度總題數", () => {
  assert.equal(clampQuestionCount("10", 8), 8);
  assert.equal(clampQuestionCount("0", 8), 1);
  assert.equal(clampQuestionCount("無效", 38), 10);
});

test("隨機抽題不重複且關閉隨機時維持題號順序", () => {
  const ordered = makeItems(exam, 5, false);
  assert.deepEqual(ordered.map((item) => item.no), [1, 2, 3, 4, 5]);
  const random = makeItems(exam, 8, true, () => 0.37);
  assert.equal(new Set(random.map((item) => item.no)).size, 8);
  assert.notDeepEqual(random.map((item) => item.no), ordered.map((item) => item.no));
});

test("複選年度後可從跨年度候選池抽題", () => {
  const older = { year: 114, questionCount: 2, answers: ["D", "C"], questionUrl: "https://example.test/114.pdf" };
  const candidates = [{ exam, no: 1 }, { exam, no: 2 }, { exam: older, no: 1 }, { exam: older, no: 2 }];
  const items = makeItemsFromCandidates(candidates, 4, false);
  assert.deepEqual(items.map((item) => `${item.year}-${item.no}`), ["115-1", "115-2", "114-1", "114-2"]);
  assert.deepEqual(items.map((item) => item.answer), ["A", "B", "D", "C"]);
});

test("雙答案任一正解得分，送分題即使留白也得分", () => {
  const items = [
    { year: 90, no: 19, answer: "B、C" },
    { year: 91, no: 40, answer: "B、D" },
    { year: 97, no: 19, answer: "送分" },
  ];
  const outcome = gradeItems(items, { "90-19": "C", "91-40": "D" });
  assert.deepEqual(acceptedAnswers("B、C"), ["B", "C"]);
  assert.equal(outcome.correct, 3);
  assert.equal(outcome.wrong.length, 0);
  assert.equal(outcome.unanswered.length, 0);
});

test("錯題本以年度題號去重，重練答對後移除", () => {
  const current = [{ year: 115, no: 3 }, { year: 114, no: 2 }];
  const merged = mergeWrongBook(current, [{ year: 115, no: 3 }, { year: 115, no: 5 }], [{ year: 114, no: 2 }]);
  assert.deepEqual(merged, [{ year: 115, no: 3 }, { year: 115, no: 5 }]);
});
