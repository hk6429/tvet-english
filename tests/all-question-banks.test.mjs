import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const context = { window: {} };
vm.createContext(context);
vm.runInContext(readFileSync(new URL("../data/exams.js", import.meta.url), "utf8"), context);
vm.runInContext(readFileSync(new URL("../data/questions.js", import.meta.url), "utf8"), context);

const exams = context.window.EXAMS;
const banks = context.window.QUESTION_BANK;
const allowedCategories = new Set(["C1", "C2", "C3", "C4", "C5", "C6"]);
const allowedTags = new Set([
  "語境選字", "同義字辨識", "搭配詞運用", "介系詞運用", "連接詞運用", "分詞結構",
  "情境對話", "日常購物", "休閒娛樂", "節慶文化", "終身學習", "健康安全", "家庭協作",
  "技職競賽", "求職表達", "公民生活", "人物與環境", "段落語意", "結尾統整", "明示訊息",
  "後續推測", "趨勢判讀", "資訊整合", "圖表判讀", "反向細節", "時序重組", "結論判斷",
  "因果推論", "主旨判斷", "語意推論", "事實判斷",
]);

test("90–115 年共 26 份、1,196 題，題號與官方答案逐題相符", () => {
  assert.equal(banks.length, 26);
  assert.equal(banks.reduce((sum, bank) => sum + bank.questions.length, 0), 1196);
  for (const exam of exams) {
    const bank = banks.find((item) => item.year === exam.year);
    assert.ok(bank, `${exam.year} 年題庫不存在`);
    assert.equal(bank.questions.length, exam.questionCount, `${exam.year} 年題數`);
    assert.deepEqual(Array.from(bank.questions, (question) => question.no), Array.from({ length: exam.questionCount }, (_, index) => index + 1), `${exam.year} 年題號`);
    assert.deepEqual(Array.from(bank.questions, (question) => question.answer), Array.from(exam.answers), `${exam.year} 年官方答案`);
  }
});

test("每題都有題幹、A–D 選項、分類與解析", () => {
  for (const bank of banks) {
    for (const question of bank.questions) {
      const label = `${bank.year}-${question.no}`;
      assert.ok(question.stem.trim().length >= 2, `${label} 題幹`);
      assert.deepEqual(Object.keys(question.options), ["A", "B", "C", "D"], `${label} 選項鍵`);
      for (const choice of ["A", "B", "C", "D"]) assert.ok(question.options[choice].trim(), `${label}-${choice} 選項`);
      assert.ok(allowedCategories.has(question.cat), `${label} 分類 ${question.cat}`);
      assert.ok(question.tags?.length, `${label} 小標`);
      for (const tag of question.tags) assert.ok(allowedTags.has(tag), `${label} 小標 ${tag}`);
      if (bank.year !== 115) assert.ok(question.explain?.length >= 25, `${label} 解析`);
    }
  }
});

test("題組引用存在、範圍不重疊，篇章題都有題組材料", () => {
  for (const bank of banks) {
    const owner = new Map();
    for (const [id, group] of Object.entries(bank.groups)) {
      assert.ok(group.title?.trim(), `${bank.year}-${id} 標題`);
      assert.ok(group.passage?.trim() || group.image, `${bank.year}-${id} 材料`);
      const match = id.match(/^G(\d+)_(\d+)$/);
      assert.ok(match, `${bank.year}-${id} 題組 ID`);
      const [, start, end] = match.map(Number);
      for (let no = start; no <= end; no += 1) {
        assert.ok(!owner.has(no), `${bank.year}-${no} 同時屬於 ${owner.get(no)} 與 ${id}`);
        owner.set(no, id);
      }
    }
    for (const question of bank.questions) {
      if (question.group) assert.ok(bank.groups[question.group], `${bank.year}-${question.no} 引用不存在的 ${question.group}`);
      if (["C4", "C5", "C6"].includes(question.cat)) assert.ok(question.group || question.passage, `${bank.year}-${question.no} 缺少篇章材料`);
    }
  }
});

test("題庫引用的官方原卷圖片都存在", () => {
  for (const bank of banks) {
    const paths = [
      ...Object.values(bank.groups).map((group) => group.image),
      ...bank.questions.map((question) => question.sourcePageImage),
      ...Object.values(bank.groups).flatMap((group) => [...String(group.passage ?? "").matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1])),
    ].filter(Boolean);
    for (const path of paths) assert.ok(existsSync(new URL(`../${path}`, import.meta.url)), `${bank.year} 缺少 ${path}`);
  }
});

test("選項未混入下一題或段落標題", () => {
  for (const bank of banks) {
    for (const question of bank.questions) {
      const label = `${bank.year}-${question.no}`;
      for (const [choice, value] of Object.entries(question.options)) {
        assert.ok(value.length < 300, `${label}-${choice} 選項過長`);
        assert.doesNotMatch(value, /(?:字彙|對話|綜合|閱讀)測驗|回答第\s*\d+[至－–—-]\d+\s*題/, `${label}-${choice} 混入段落`);
      }
    }
  }
});

test("93 年掃描題本的高風險 OCR 字句已由人工校正層固定", () => {
  const bank = banks.find((item) => item.year === 93);
  assert.equal(bank.questions[6].stem, "I usually have a busy schedule, but once in a while I spend a few days in the mountains.");
  assert.equal(bank.questions[14].stem, "The victim of the plane crash stayed ____________ for two weeks, and then died last night.");
  assert.equal(bank.questions[17].options.C, "I’ve got an awful headache.");
  assert.equal(bank.questions[23].options.D, "just bring it in");
  assert.equal(bank.questions[49].options.D, "a new source of electrical energy");
  assert.match(bank.groups.G41_45.passage, /NT\$100 million/);
  assert.match(bank.groups.G46_50.passage, /Chernobyl in the former USSR/);
});

test("106、107 年缺文字層頁面與 115 年空格均有固定校正", () => {
  const bank106 = banks.find((item) => item.year === 106);
  assert.match(bank106.questions[12].stem, /desk lamp was broken/);
  assert.equal(bank106.questions[16].stem.split("\n")[0], "Jill: When is your monthly test?");
  assert.equal(bank106.questions[17].options.D, "Please turn right at the next corner to find the center.");
  const bank107 = banks.find((item) => item.year === 107);
  assert.equal(bank107.questions[34].options.D, "promoting");
  assert.match(bank107.groups.G34_37.passage, /NT\$90 million/);
  const bank115 = banks.find((item) => item.year === 115);
  for (const no of [11, 14, 18, 19, 20]) assert.match(bank115.questions[no - 1].stem, /_{3,}/, `115-${no} 空格`);
});

test("題幹與選項沒有混入頁首頁尾或已知 OCR 雜訊", () => {
  const noise = /公告試題僅供參考|第\s*\d+\s*[頁真]|共\s*\$?\d+\s*[頁真]|◢|\b(?:Tusually|Ifyou|Ina|mght|referstothe|Sif|Pil)\b/;
  for (const bank of banks) {
    for (const question of bank.questions) {
      const content = [question.stem, ...Object.values(question.options)].join(" ");
      assert.doesNotMatch(content, noise, `${bank.year}-${question.no} 含版面或 OCR 雜訊`);
    }
  }
});
