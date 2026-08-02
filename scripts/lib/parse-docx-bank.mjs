import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import { load } from "cheerio";
import { classifyQuestion, explanationFor } from "./question-metadata.mjs";

const SECTION_PATTERNS = [
  ["vocabulary", /字彙(?:及慣用語)?題/],
  ["dialogue", /對話題/],
  ["cloze", /綜合測驗/],
  ["reading", /閱讀測驗/],
];

function normalize(value) {
  return value.replace(/[\sˉ]+/g, " ").trim();
}

function groupRange(text) {
  const compact = text.replace(/\s+/g, "");
  const match = compact.match(/(?:回答第?|為第)(\d+)[－–—-](\d+)題/);
  return match ? { start: Number(match[1]), end: Number(match[2]) } : null;
}

export function parseDocxBank({ year, docxPath, expected, answers, outputImageRoot, publicImageRoot }) {
  const temp = mkdtempSync(join(tmpdir(), `tvet-english-${year}-`));
  const htmlFile = join(temp, `${year}.html`);
  const mediaRoot = join(temp, "media");
  execFileSync("pandoc", [docxPath, "-t", "html", `--extract-media=${mediaRoot}`, "-o", htmlFile]);

  const $ = load(readFileSync(htmlFile, "utf8"));
  const copiedMedia = new Map();
  mkdirSync(outputImageRoot, { recursive: true });

  function publicMedia(src) {
    if (!src) return null;
    if (/\.(?:emf|wmf)$/i.test(src)) return null;
    if (copiedMedia.has(src)) return copiedMedia.get(src);
    const name = basename(src);
    copyFileSync(src, join(outputImageRoot, name));
    const publicPath = `${publicImageRoot}/${name}`;
    copiedMedia.set(src, publicPath);
    return publicPath;
  }

  function cleanHtml(html) {
    const fragment = load(`<div id="root">${html}</div>`);
    fragment("img").each((_, image) => {
      const src = fragment(image).attr("src");
      const publicPath = publicMedia(src);
      if (publicPath) fragment(image).attr("src", publicPath).addClass("source-figure").removeAttr("style");
      else fragment(image).replaceWith('<span class="source-image-note">〔本材料含官方圖像，請查看下方原卷頁面〕</span>');
    });
    fragment("[style]").removeAttr("style");
    return fragment("#root").html()?.trim() ?? "";
  }

  const questions = [];
  const groups = {};
  const skippedNestedRows = new Set();
  let current = null;
  let activeGroup = null;
  let currentSection = "vocabulary";
  let started = false;

  function finish(question) {
    if (!question) return;
    const keys = Object.keys(question.options).sort().join("");
    if (keys !== "ABCD") throw new Error(`${year} 年第 ${question.no} 題選項不完整：${keys}`);
    for (const choice of ["A", "B", "C", "D"]) {
      if (!question.options[choice]) {
        question.options[choice] = "〔圖像選項，請查看下方官方原卷圖〕";
        question.requiresSourcePage = true;
      }
    }
    if (!question.passage) delete question.passage;
    question.answer = answers[question.no - 1];
    question.explain = explanationFor(question, question.section);
    delete question.section;
    questions.push(question);
  }

  function parseOptions(row, question) {
    $(row).find("th,td").each((_, cell) => {
      const text = normalize($(cell).text());
      const match = text.match(/^\(([A-D])\)\s*(.*)$/s);
      if (!match) return;
      const hasImage = $(cell).find("img").length > 0;
      question.options[match[1]] = match[2] || (hasImage ? "〔圖像選項，請查看官方原卷圖〕" : "");
      if (hasImage) question.requiresSourcePage = true;
    });
  }

  for (const row of $("tr").toArray()) {
    if (skippedNestedRows.has(row)) continue;
    const rowText = normalize($(row).text());
    const compact = rowText.replace(/\s+/g, "");
    if (!started) {
      if (rowText.includes("選擇題") && compact.includes(`第1至${expected}題`)) started = true;
      else continue;
    }
    if (rowText.includes("非選擇題") || rowText.includes("【以下空白】")) break;
    if (!rowText || rowText === "ˉ") continue;

    for (const [section, pattern] of SECTION_PATTERNS) {
      if (pattern.test(rowText)) currentSection = section;
    }

    const range = groupRange(rowText);
    if (range && (rowText.startsWith("▲") || rowText.includes("下篇短文共有") || rowText.includes("閱讀下文") || rowText.includes("根據以下"))) {
      finish(current);
      current = null;
      activeGroup = { id: `G${range.start}_${range.end}`, ...range, rows: [] };
      groups[activeGroup.id] = { title: `▲閱讀材料，回答第 ${range.start}–${range.end} 題`, passage: "" };
      continue;
    }

    const questionParagraph = $(row).find("p").toArray().find((paragraph) => /^(\d+)\.\s*/.test(normalize($(paragraph).text())));
    const questionText = questionParagraph ? normalize($(questionParagraph).text()) : rowText;
    const questionMatch = questionText.match(/^(\d+)\.\s*(.*)/s) ?? questionText.match(/^(\d+)\s+(?=\(A\))/s);
    const no = questionMatch ? Number(questionMatch[1]) : 0;
    if (no >= 1 && no <= expected) {
      finish(current);
      const container = questionParagraph ? $(questionParagraph) : ($(row).find("blockquote").first().length ? $(row).find("blockquote").first() : $(row).find("th,td").first());
      container.find("u").each((_, underline) => {
        if (!normalize($(underline).text().replace(/[\uF000-\uF8FF]/g, ""))) $(underline).text("____________");
      });
      const rawStem = normalize(container.text()).replace(new RegExp(`^${no}\\.?\\s*`), "").replace(/^\(A\).*$/s, "");
      const group = activeGroup && no >= activeGroup.start && no <= activeGroup.end ? activeGroup.id : undefined;
      const classification = classifyQuestion(currentSection, rawStem);
      current = {
        no,
        ...classification,
        section: currentSection,
        stem: rawStem || (currentSection === "cloze" ? `請依文章文意，選出第 ${no} 空最適合的答案。` : `請依題目內容選出第 ${no} 題最適當的答案。`),
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

  if (questions.length !== expected) {
    const found = new Set(questions.map((question) => question.no));
    const missing = Array.from({ length: expected }, (_, index) => index + 1).filter((no) => !found.has(no));
    throw new Error(`${year} 年只解析到 ${questions.length}/${expected} 題；缺 ${missing.join(",")}`);
  }
  for (let index = 0; index < questions.length; index += 1) {
    if (questions[index].no !== index + 1) throw new Error(`${year} 年題號不連續：index ${index} 是 ${questions[index].no}`);
    if (questions[index].answer !== answers[index]) throw new Error(`${year} 年第 ${index + 1} 題答案未與官方答案對齊`);
  }
  return { year, groups, questions, copiedMedia: [...copiedMedia.values()] };
}
