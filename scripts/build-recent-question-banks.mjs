import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CACHE_DIR, cachedQuestionDocx, cachedQuestionPdf, expectedQuestionCount, loadOfficialExams, officialPage, questionDocxUrl } from "./lib/official-sources.mjs";
import { parseDocxBank } from "./lib/parse-docx-bank.mjs";
import { parsePdfBank } from "./lib/parse-pdf-bank.mjs";
import { extractPdfTextByPage } from "./lib/pdf-text.mjs";
import { renderSourcePage } from "./lib/source-page-images.mjs";

const exams = loadOfficialExams();
const years = [110, 111, 112, 113, 114];
const outputRoot = new URL("../data/years/", import.meta.url);
mkdirSync(outputRoot, { recursive: true });

for (const year of years) {
  const exam = exams.find((item) => item.year === year);
  const docxPath = await cachedQuestionDocx(year);
  const imageUrl = new URL(`../img/${year}/source/`, import.meta.url);
  const bank = parseDocxBank({
    year,
    docxPath,
    expected: expectedQuestionCount(year),
    answers: exam.answers,
    outputImageRoot: fileURLToPath(imageUrl),
    publicImageRoot: `img/${year}/source`,
  });
  const pdfPath = await cachedQuestionPdf(year);
  const { text: pdfText } = extractPdfTextByPage(pdfPath, year, CACHE_DIR);
  const pdfBank = parsePdfBank({ year, text: pdfText, expected: expectedQuestionCount(year), answers: exam.answers });
  for (const question of bank.questions) {
    const pdfQuestion = pdfBank.questions[question.no - 1];
    const docxBlankCount = (question.stem.match(/_{3,}/g) ?? []).length;
    const pdfBlankCount = (pdfQuestion.stem.match(/_{3,}/g) ?? []).length;
    if (pdfBlankCount > docxBlankCount) question.stem = pdfQuestion.stem;
  }
  const sourcePageOutput = fileURLToPath(new URL(`../img/${year}/pages/`, import.meta.url));
  for (const question of bank.questions.filter((item) => item.requiresSourcePage)) {
    const rendered = renderSourcePage({
      pdfPath,
      year,
      no: question.no,
      outputRoot: sourcePageOutput,
      publicRoot: `img/${year}/pages`,
    });
    question.sourcePageImage = rendered.path;
    delete question.requiresSourcePage;
  }
  for (const [groupId, group] of Object.entries(bank.groups)) {
    if (!group.passage.includes("source-image-note")) continue;
    const no = Number(groupId.match(/^G(\d+)/)?.[1]);
    const rendered = renderSourcePage({
      pdfPath,
      year,
      no,
      outputRoot: sourcePageOutput,
      publicRoot: `img/${year}/pages`,
    });
    group.image = rendered.path;
  }
  const payload = {
    year,
    source: questionDocxUrl(year),
    officialPage: officialPage(year),
    groups: bank.groups,
    questions: bank.questions,
  };
  const target = new URL(`../data/years/questions-${year}.js`, import.meta.url);
  writeFileSync(target, `window.QUESTION_BANK = window.QUESTION_BANK || [];\nwindow.QUESTION_BANK.push(${JSON.stringify(payload, null, 2)});\n`);
  console.log(`${year}: ${bank.questions.length} 題、${Object.keys(bank.groups).length} 組、${bank.copiedMedia.length} 個媒體檔`);
}
