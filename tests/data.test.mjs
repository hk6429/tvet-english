import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const context = { window: {} };
vm.runInNewContext(readFileSync(new URL("../data/exams.js", import.meta.url), "utf8"), context);
const exams = context.window.EXAMS;

test("收錄 90–115 共 26 年、1,196 題選擇題", () => {
  assert.equal(exams.length, 26);
  assert.deepEqual(Array.from(exams, (exam) => exam.year), Array.from({ length: 26 }, (_, index) => index + 90));
  assert.equal(exams.reduce((sum, exam) => sum + exam.questionCount, 0), 1196);
});

test("各制度年度題數與官方題本一致", () => {
  for (const exam of exams) {
    const expected = exam.year <= 103 ? 50 : exam.year === 104 ? 40 : exam.year <= 110 ? 41 : 42;
    assert.equal(exam.questionCount, expected, `${exam.year} 題數`);
    assert.equal(exam.answers.length, expected, `${exam.year} 答案數`);
  }
});

test("所有答案格式合法且來源只指向統測中心", () => {
  for (const exam of exams) {
    for (const answer of exam.answers) assert.match(answer, /^(?:[ABCD]|[ABCD]、[ABCD]|送分)$/);
    for (const field of ["questionUrl", "answerUrl", "sourcePage"]) {
      assert.equal(new URL(exam[field]).hostname, "web1.tcte.edu.tw");
    }
  }
});

test("115 年公告答案關鍵題逐題固定", () => {
  const exam = exams.find((item) => item.year === 115);
  assert.equal(exam.answers[4], "A");
  assert.equal(exam.answers[33], "B");
  assert.equal(exam.answers[41], "C");
});
