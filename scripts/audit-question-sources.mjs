import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  CACHE_DIR,
  cachedQuestionDocx,
  cachedQuestionPdf,
  expectedQuestionCount,
  loadOfficialExams,
  questionDocxUrl,
  questionPdfUrl,
} from "./lib/official-sources.mjs";
import { extractPdfTextByPage } from "./lib/pdf-text.mjs";
import { parsePdfBank } from "./lib/parse-pdf-bank.mjs";

const START_YEAR = 90;
const END_YEAR = 115;
const exams = loadOfficialExams();
const report = [];

for (let year = START_YEAR; year <= END_YEAR; year += 1) {
  const expected = expectedQuestionCount(year);
  const pdfPath = await cachedQuestionPdf(year);
  const docxPath = await cachedQuestionDocx(year);
  const { text, methods } = extractPdfTextByPage(pdfPath, year, CACHE_DIR);
  const textPath = join(CACHE_DIR, `${year}.txt`);
  writeFileSync(textPath, text);
  const exam = exams.find((item) => item.year === year);
  const parsed = parsePdfBank({ year, text, expected, answers: exam.answers });
  const numbers = parsed.questions.map((question) => question.no);
  const missing = Array.from({ length: expected }, (_, index) => index + 1).filter((no) => !numbers.includes(no));
  report.push({
    year,
    expected,
    found: numbers.length,
    missing,
    extraction: methods.includes("ocr") ? "pdftotext+ocr" : "pdftotext",
    pdf: questionPdfUrl(year),
    docx: questionDocxUrl(year),
    docxCached: Boolean(docxPath),
    answers: exam?.answers.length ?? 0,
    answerVerified: exam?.answerVerified === true,
  });
  console.log(`${year}: ${numbers.length}/${expected} (${methods.includes("ocr") ? "pdftotext+ocr" : "pdftotext"})${missing.length ? `，缺 ${missing.join(",")}` : ""}`);
}

const output = new URL("../data/source-audit.json", import.meta.url);
writeFileSync(output, `${JSON.stringify({ years: report }, null, 2)}\n`);
console.log(`wrote ${report.length} years to ${output.pathname}`);
