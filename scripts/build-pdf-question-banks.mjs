import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CACHE_DIR, cachedQuestionPdf, expectedQuestionCount, loadOfficialExams, officialPage, questionPdfUrl } from "./lib/official-sources.mjs";
import { extractPdfTextByPage } from "./lib/pdf-text.mjs";
import { parsePdfBank } from "./lib/parse-pdf-bank.mjs";
import { renderSourcePage } from "./lib/source-page-images.mjs";

const exams = loadOfficialExams();
const requestedYears = process.argv.slice(2).map(Number).filter((year) => Number.isInteger(year) && year >= 90 && year <= 109);
const years = requestedYears.length ? requestedYears : Array.from({ length: 20 }, (_, index) => 90 + index);
const outputRoot = new URL("../data/years/", import.meta.url);
mkdirSync(outputRoot, { recursive: true });

for (const year of years) {
  const exam = exams.find((item) => item.year === year);
  const pdfPath = await cachedQuestionPdf(year);
  const { text, methods } = extractPdfTextByPage(pdfPath, year, CACHE_DIR);
  const bank = parsePdfBank({ year, text, expected: expectedQuestionCount(year), answers: exam.answers });
  const pageOutput = fileURLToPath(new URL(`../img/${year}/pages/`, import.meta.url));
  const pagePublic = `img/${year}/pages`;
  const renderedPages = new Map();
  const ensurePage = (no) => {
    const question = bank.questions[no - 1];
    if (renderedPages.has(question.sourcePage)) return renderedPages.get(question.sourcePage);
    const rendered = renderSourcePage({ pdfPath, year, no, page: question.sourcePage, outputRoot: pageOutput, publicRoot: pagePublic });
    renderedPages.set(question.sourcePage, rendered.path);
    return rendered.path;
  };

  for (const question of bank.questions) {
    const visualCue = /chart|graph|table|diagram|picture|map|poster|menu|advertisement/i.test(question.stem);
    if (question.requiresSourcePage || visualCue || methods[question.sourcePage - 1] === "ocr") question.sourcePageImage = ensurePage(question.no);
    delete question.requiresSourcePage;
  }
  for (const group of Object.values(bank.groups)) {
    const visualCue = /chart|graph|table|diagram|picture|map|poster|menu|advertisement/i.test(group.passage);
    if (visualCue) group.image = ensurePage(Number(group.title.match(/第 (\d+)/)?.[1]));
    delete group.page;
  }
  for (const question of bank.questions) delete question.sourcePage;

  const payload = { year, source: questionPdfUrl(year), officialPage: officialPage(year), groups: bank.groups, questions: bank.questions };
  const target = new URL(`../data/years/questions-${year}.js`, import.meta.url);
  writeFileSync(target, `window.QUESTION_BANK = window.QUESTION_BANK || [];\nwindow.QUESTION_BANK.push(${JSON.stringify(payload, null, 2)});\n`);
  console.log(`${year}: ${bank.questions.length} 題、${Object.keys(bank.groups).length} 組、${renderedPages.size} 張原卷頁圖`);
}
