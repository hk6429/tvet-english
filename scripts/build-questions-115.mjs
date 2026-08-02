import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "cheerio";

const SOURCE_DOCX = "https://web1.tcte.edu.tw/EXAM/115_4y/downloader.php?obj=MTE1LTR5LTAwLWUuZG9jeA==";
const OUTPUT = new URL("../data/questions-115.js", import.meta.url);
const temp = mkdtempSync(join(tmpdir(), "tvet-english-115-"));
const docx = join(temp, "115.docx");
const htmlFile = join(temp, "115.html");

execFileSync("curl", ["-LfsS", SOURCE_DOCX, "-o", docx], { stdio: "inherit" });
execFileSync("pandoc", [docx, "-t", "html", "-o", htmlFile], { stdio: "inherit" });

const $ = load(readFileSync(htmlFile, "utf8"));
const questions = [];
const groups = {};
const skippedNestedRows = new Set();
let current = null;
let activeGroup = null;
let started = false;

const normalize = (value) => value.replace(/[\sˉ]+/g, " ").trim();
const cleanHtml = (html) => {
  const fragment = load(`<div id="root">${html}</div>`);
  fragment("img").replaceWith('<span class="source-image-note">〔本題含官方圖表，請搭配原題本查看〕</span>');
  fragment("[style]").removeAttr("style");
  return fragment("#root").html()?.trim() ?? "";
};

function finish(question) {
  if (!question) return;
  const keys = Object.keys(question.options).sort().join("");
  if (keys !== "ABCD") throw new Error(`第 ${question.no} 題選項不完整：${keys}`);
  if (!question.passage) delete question.passage;
  questions.push(question);
}

const QUESTION_METADATA = {
  1: ["C1", "語境選字"], 2: ["C1", "語境選字"], 3: ["C1", "語境選字"], 4: ["C1", "語境選字"],
  5: ["C1", "語境選字"], 6: ["C1", "語境選字"], 7: ["C1", "語境選字"], 8: ["C1", "語境選字"],
  9: ["C1", "同義字辨識"], 10: ["C1", "同義字辨識"],
  11: ["C3", "日常購物"], 12: ["C3", "休閒娛樂"], 13: ["C3", "節慶文化"], 14: ["C3", "終身學習"],
  15: ["C3", "健康安全"], 16: ["C3", "家庭協作"], 17: ["C3", "技職競賽"], 18: ["C3", "求職表達"],
  19: ["C3", "公民生活"], 20: ["C3", "人物與環境"],
  21: ["C2", "介系詞運用"], 22: ["C1", "語境選字"], 23: ["C2", "連接詞運用"], 24: ["C4", "段落語意"],
  25: ["C1", "搭配詞運用"], 26: ["C2", "分詞結構"], 27: ["C2", "連接詞運用"], 28: ["C4", "結尾統整"],
  29: ["C5", "明示訊息"], 30: ["C5", "後續推測"], 31: ["C5", "趨勢判讀"], 32: ["C5", "資訊整合"],
  33: ["C5", "圖表判讀"], 34: ["C5", "反向細節"], 35: ["C5", "時序重組"],
  36: ["C6", "結論判斷"], 37: ["C6", "資訊整合"], 38: ["C6", "因果推論"], 39: ["C6", "主旨判斷"],
  40: ["C6", "反向細節"], 41: ["C6", "語意推論"], 42: ["C6", "事實判斷"],
};

function metadata(no) {
  const [cat, tag] = QUESTION_METADATA[no] ?? [];
  if (!cat || !tag) throw new Error(`第 ${no} 題缺少分類`);
  return { cat, tags: [tag] };
}

function groupRange(text) {
  const match = text.match(/(?:回答第?|為第)\s*(\d+)\s*[－-]\s*(\d+)\s*題/);
  if (!match) return null;
  return { start: Number(match[1]), end: Number(match[2]) };
}

function parseOptions(row, question) {
  $(row).find("th,td").each((_, cell) => {
    const text = normalize($(cell).text());
    const match = text.match(/^\(([A-D])\)\s*(.*)$/s);
    if (match) question.options[match[1]] = match[2] || "〔圖像選項，請參照官方題本〕";
  });
}

const rows = $("tr").toArray();
for (const row of rows) {
  if (skippedNestedRows.has(row)) continue;
  const rowText = normalize($(row).text());
  if (!started) {
    if (rowText.includes("選擇題") && rowText.includes("第1至42題")) started = true;
    continue;
  }
  if (rowText.startsWith("二、非選擇題")) break;
  if (!rowText || rowText === "ˉ") continue;

  const range = (rowText.startsWith("▲") || rowText.includes("下篇短文共有")) ? groupRange(rowText) : null;
  if (range) {
    finish(current);
    current = null;
    activeGroup = { id: `G${range.start}_${range.end}`, ...range, rows: [] };
    groups[activeGroup.id] = { title: `▲閱讀材料，回答第 ${range.start}–${range.end} 題`, passage: "" };
    continue;
  }

  const questionMatch = rowText.match(/^(\d+)\.\s*(.*)/s);
  const no = questionMatch ? Number(questionMatch[1]) : 0;
  if (no >= 1 && no <= 42) {
    finish(current);
    const container = $(row).find("blockquote").first().length ? $(row).find("blockquote").first() : $(row).find("th,td").first();
    const rawStem = normalize(container.text()).replace(new RegExp(`^${no}\\.\\s*`), "");
    const group = activeGroup && no >= activeGroup.start && no <= activeGroup.end ? activeGroup.id : undefined;
    current = {
      no,
      ...metadata(no),
      stem: rawStem || `請依第 ${group?.slice(1).replace("_", "–") ?? no} 題材料選出最適當答案。`,
      options: {},
      ...(group ? { group } : {}),
    };
    parseOptions(row, current);
    if (activeGroup && no === activeGroup.start) {
      groups[activeGroup.id].passage = cleanHtml(`<table>${activeGroup.rows.join("")}</table>`);
    }
    continue;
  }

  if (activeGroup && !current) {
    activeGroup.rows.push($.html(row));
    $(row).find("tr").each((_, nestedRow) => skippedNestedRows.add(nestedRow));
    continue;
  }

  if (!current) continue;
  parseOptions(row, current);
}
finish(current);

if (questions.length !== 42) throw new Error(`只解析到 ${questions.length}/42 題`);
const answers = "DBBDAADAACBBCDACABCBADACBAADACCDBBCDDCBDDC".split("");
if (answers.length !== 42) throw new Error(`答案數量錯誤：${answers.length}`);
questions.forEach((question, index) => { question.answer = answers[index]; });

groups.G31_32.image = "img/115/g31-32.png";
groups.G33_35.image = "img/115/g33-35.png";

const payload = {
  year: 115,
  source: SOURCE_DOCX,
  officialPage: "https://web1.tcte.edu.tw/EXAM/115_4y/",
  groups,
  questions,
};
writeFileSync(OUTPUT, `window.QUESTION_BANK = window.QUESTION_BANK || [];\nwindow.QUESTION_BANK.push(${JSON.stringify(payload, null, 2)});\n`);
console.log(`wrote ${questions.length} questions to ${fileURLToPath(OUTPUT)}`);
