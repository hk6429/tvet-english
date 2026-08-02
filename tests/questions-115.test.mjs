import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { OFFICIAL_OPTION_STATS_115, QUESTION_INSIGHTS_115 } from "../data/insights-115.mjs";

const context = { window: {} };
vm.runInNewContext(readFileSync(new URL("../data/exams.js", import.meta.url), "utf8"), context);
vm.runInNewContext(readFileSync(new URL("../data/questions-115.js", import.meta.url), "utf8"), context);
const exam = context.window.EXAMS.find((item) => item.year === 115);
const bank = context.window.QUESTION_BANK.find((item) => item.year === 115);

test("115 年 42 題均有題幹、四選項與逐題官方答案", () => {
  assert.equal(bank.questions.length, 42);
  for (const [index, question] of bank.questions.entries()) {
    assert.equal(question.no, index + 1);
    assert.ok(question.stem.length >= 4, `第 ${question.no} 題題幹`);
    assert.deepEqual(Object.keys(question.options), ["A", "B", "C", "D"]);
    assert.equal(question.answer, exam.answers[index], `第 ${question.no} 題答案`);
  }
});

test("115 年七組題組均有材料，必要圖表已落地", () => {
  assert.deepEqual(Object.keys(bank.groups), ["G21_24", "G25_28", "G29_30", "G31_32", "G33_35", "G36_38", "G39_42"]);
  for (const [id, group] of Object.entries(bank.groups)) assert.ok(group.passage.length > 100, id);
  for (const id of ["G31_32", "G33_35"]) {
    assert.ok(bank.groups[id].image, id);
    assert.ok(existsSync(new URL(`../${bank.groups[id].image}`, import.meta.url)), id);
  }
});

test("分類只使用六個大標與受控小標", () => {
  const allowed = {
    C1: ["語境選字", "同義字辨識", "搭配詞運用"],
    C2: ["介系詞運用", "連接詞運用", "分詞結構"],
    C3: ["日常購物", "休閒娛樂", "節慶文化", "終身學習", "健康安全", "家庭協作", "技職競賽", "求職表達", "公民生活", "人物與環境"],
    C4: ["段落語意", "結尾統整"],
    C5: ["明示訊息", "後續推測", "趨勢判讀", "資訊整合", "圖表判讀", "反向細節", "時序重組"],
    C6: ["結論判斷", "資訊整合", "因果推論", "主旨判斷", "反向細節", "語意推論", "事實判斷"],
  };
  assert.deepEqual([...new Set(bank.questions.map((question) => question.cat))].sort(), Object.keys(allowed));
  for (const question of bank.questions) {
    assert.ok(question.tags.length >= 1 && question.tags.length <= 3, `第 ${question.no} 題標籤數`);
    for (const tag of question.tags) assert.ok(allowed[question.cat].includes(tag), `第 ${question.no} 題 ${question.cat}/${tag}`);
  }
});

test("六大標分布不讓單一類別超過 30%", () => {
  const counts = Object.groupBy(bank.questions, (question) => question.cat);
  for (const [cat, questions] of Object.entries(counts)) assert.ok(questions.length <= 12, `${cat} 題數過度集中`);
});

test("42 題皆有教師解析，官方選項統計只收錄研討會題例", () => {
  assert.deepEqual(Object.keys(QUESTION_INSIGHTS_115).map(Number), Array.from({ length: 42 }, (_, index) => index + 1));
  assert.deepEqual(Object.keys(OFFICIAL_OPTION_STATS_115).map(Number), [1, 2, 22, 28, 29, 32, 35, 36, 40]);
  for (let no = 1; no <= 42; no += 1) assert.ok(QUESTION_INSIGHTS_115[no].explain.length >= 25, `第 ${no} 題解析`);
});
