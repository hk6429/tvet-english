import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");

test("附圖首頁主要操作均有穩定控制 ID", () => {
  for (const id of ["quickStartButton", "yearPicker", "yearOptions", "selectAllYears", "clearAllYears", "categoryFilter", "questionCount", "randomToggle", "timedToggle", "difficultySelect", "discriminationSelect", "wrongBookButton", "historyButton", "mockButton", "teacherButton", "rankButton", "paperSize", "printButton", "wordButton", "selectAllTeacher", "selectNoneTeacher"]) {
    assert.match(html, new RegExp(`id="${id}"`), id);
  }
});

test("不再提供固定五題的今日複習功能", () => {
  assert.doesNotMatch(html, /dailyButton|今日練習 5 題/);
  assert.doesNotMatch(app, /startDaily|todayText|dailyButton/);
});

test("年度選擇支援複選、全選與清除", () => {
  assert.doesNotMatch(html, /id="yearSelect"/);
  assert.match(app, /const selectedYears = new Set/);
  assert.match(app, /setSelectedYears\(exams\.map/);
  assert.match(app, /filteredCandidates\(\)/);
});

test("快速十題使用安全亂數且避免沿用上一組", () => {
  assert.match(html, /立即開始・隨機 10 題/);
  assert.doesNotMatch(html, /立即開始・115 年隨機 10 題/);
  assert.match(app, /function secureRandom\(\)/);
  assert.match(app, /lastQuickSignature/);
  assert.match(app, /signature !== previousSignature/);
  assert.match(app, /makeItemsFromCandidates\(directCandidates, 10, true, secureRandom\)/);
  assert.match(app, /const question = findQuestion\(exam\.year, no\)/);
  assert.match(app, /const replacement = directCandidates/);
});

test("115 年逐題資料會在主程式前載入", () => {
  const dataPosition = html.indexOf('src="data/questions-115.js?');
  const appPosition = html.indexOf('src="app.js?');
  assert.ok(dataPosition > 0 && appPosition > dataPosition);
});

test("結構化題目會切換成單欄題卡版面", () => {
  assert.match(app, /classList\.toggle\("structured", sessionItems\.every\(\(item\) => item\.question\)\)/);
  assert.match(app, /classList\.toggle\("structured-workspace", fullyStructured\)/);
});

test("作答介面明確承諾逐題即時回饋", () => {
  assert.match(html, /選定選項後，立即顯示正誤、正解、解析與已公開的官方統計/);
  assert.match(app, /function handleAnswerChange\(event\)/);
  assert.match(app, /renderQuestionFeedback\(responses\)/);
  assert.match(app, /feedback-status/);
  assert.match(app, /input\.disabled = Boolean\(selected\)/);
});

test("首頁具有大分類、小分類與完整老師出卷入口", () => {
  assert.match(app, /const SUBCATEGORIES =/);
  assert.match(app, /const CATEGORY_AXES =/);
  assert.match(app, /category-detail-toggle/);
  assert.match(app, /大標・/);
  assert.match(app, />小標</);
  assert.match(html, /技術型高中英語文課綱分類/);
  assert.match(html, /stv\.naer\.edu\.tw\/data\/course_outline/);
  assert.match(html, /id="advancedToggle"[^>]*aria-expanded="true"/);
  assert.doesNotMatch(html, /id="builderBody" hidden/);
  assert.match(html, /勾選題目，建立線上測驗或可編輯考卷/);
  assert.match(app, /function downloadTeacherWord\(\)/);
  assert.match(app, /function teacherPaperHtml\(items\)/);
});

test("沒有逐題證據的舊年度分類維持停用，115 年官方統計已開放", () => {
  assert.doesNotMatch(html, /id="classicalToggle"|id="modernToggle"/);
  assert.match(html, /舊年度尚未逐題結構化，因此不套用分類篩選/);
  assert.doesNotMatch(html, /id="difficultySelect"[^>]*disabled/);
  assert.doesNotMatch(html, /id="discriminationSelect"[^>]*disabled/);
  assert.match(html, /<strong>42<\/strong><span>題難度分組<\/span>/);
});

test("四專家修正具備資訊分層、無障礙與作答狀態契約", () => {
  for (const text of ["跳到主要內容", "基本練習設定", "題難度分組", "題選項分布", "本站自編解析（非官方）", "重新作答本卷", "再練一次這題"]) {
    assert.ok(html.includes(text) || app.includes(text), text);
  }
  assert.match(html, /id="answerProgress"/);
  assert.match(html, /id="storageWarning"/);
  assert.match(html, /id="closeTeacher"/);
  assert.match(app, /sessionSubmitted/);
  assert.match(app, /clearStoredAnswers/);
  assert.match(app, /wrongReasons/);
  assert.match(app, /history-retry/);
});
