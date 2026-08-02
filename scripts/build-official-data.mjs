import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = "https://web1.tcte.edu.tw/EXAM";
const expectedCount = (year) => {
  if (year <= 103) return 50;
  if (year === 104) return 40;
  if (year <= 110) return 41;
  return 42;
};
const pad = (year) => String(year).padStart(3, "0");
const downloader = (year, filename) =>
  `${ROOT}/${pad(year)}_4y/downloader.php?obj=${Buffer.from(filename).toString("base64")}`;

function sources(year) {
  const base = `${ROOT}/${pad(year)}_4y`;
  if (year === 90) return { question: `${base}/p_e.pdf`, answer: `${base}/answer.htm`, format: "pdf" };
  if (year === 91) return { question: `${base}/91-4y-00-e.pdf`, answer: `${base}/91-4y-answer-new.pdf`, format: "pdf" };
  if (year === 92) return { question: `${base}/92-4y-00-e.zip`, answer: `${base}/92-4y-00-e-solve.pdf`, format: "zip" };
  if (year === 93) return { question: `${base}/93-4y-00-e.pdf`, answer: `${base}/93-4y-00-e-finalsolve.pdf`, format: "pdf" };
  if (year === 94) return { question: `${base}/94-4y-00-e.pdf`, answer: `${base}/94-4y-00-e-standard.pdf`, format: "pdf" };
  return {
    question: downloader(year, `${year}-4y-00-e.pdf`),
    answer: downloader(year, `${year}-4y-00-e-standard.pdf`),
    format: "pdf",
  };
}

async function download(url, target) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  writeFileSync(target, Buffer.from(await response.arrayBuffer()));
}

function normalizeAnswer(value) {
  return value
    .replaceAll("Ａ", "A").replaceAll("Ｂ", "B")
    .replaceAll("Ｃ", "C").replaceAll("Ｄ", "D")
    .replace("A或B", "A、B").replace("AorB", "A、B")
    .replace("B或C", "B、C").replace("BorC", "B、C")
    .replace("B或D", "B、D").replace("BorD", "B、D");
}

function parseHtmlEnglishColumn(html) {
  const answers = new Map();
  for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) =>
      cell[1].replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/\s+/g, " ").trim()
    );
    const no = Number(cells[0]);
    if (Number.isInteger(no) && no >= 1 && no <= 60 && cells[2]) answers.set(no, normalizeAnswer(cells[2]));
  }
  return answers;
}

function parsePdf(pdfPath) {
  const raw = execFileSync("pdftotext", ["-raw", pdfPath, "-"], { encoding: "utf8" });
  const normalized = normalizeAnswer(raw);
  const answers = new Map();
  for (const match of normalized.matchAll(/(?:^|\s)(\d{1,2})\s+(A|B|C|D|送分)(?=\s|$)/g)) {
    const no = Number(match[1]);
    if (no >= 1 && no <= 60) answers.set(no, match[2]);
  }
  return answers;
}

const official91 = [
  "A", "D", "B", "A", "D", "C", "B", "A", "D", "D",
  "B", "C", "B", "D", "C", "A", "D", "C", "B", "A",
  "C", "D", "A", "C", "D", "A", "B", "C", "D", "B",
  "D", "A", "B", "B", "A", "D", "B", "C", "A", "C",
  "C", "D", "B", "A", "C", "B", "C", "A", "C", "B",
].join("");

const work = mkdtempSync(join(tmpdir(), "tvet-english-data-"));
const exams = [];

for (let year = 90; year <= 115; year += 1) {
  const source = sources(year);
  let answerMap;
  if (year === 90) {
    const path = join(work, "090-answer.htm");
    await download(source.answer, path);
    answerMap = parseHtmlEnglishColumn(readFileSync(path, "utf8"));
  } else if (year === 91) {
    const values = official91.match(/A、B|B、C|B、D|[ABCD]/g);
    answerMap = new Map(values.map((value, index) => [index + 1, value]));
  } else {
    const path = join(work, `${pad(year)}-answer.pdf`);
    await download(source.answer, path);
    answerMap = parsePdf(path);
  }

  const count = expectedCount(year);
  const answers = Array.from({ length: count }, (_, index) => answerMap.get(index + 1));
  const missing = answers.flatMap((answer, index) => (answer ? [] : [index + 1]));
  if (missing.length) throw new Error(`${year} 年答案缺漏：${missing.join(", ")}`);

  exams.push({
    year,
    era: year <= 98 ? "早期統測" : year <= 110 ? "課綱轉型期" : "108課綱",
    questionCount: count,
    questionUrl: source.question,
    questionFormat: source.format,
    answerUrl: source.answer,
    answers,
    sourcePage: `${ROOT}/${pad(year)}_4y/`,
    answerVerified: true,
  });
}

const banner = "// 由 scripts/build-official-data.mjs 自官方答案產生，請勿手改。\n";
writeFileSync(new URL("../data/exams.js", import.meta.url), `${banner}window.EXAMS = ${JSON.stringify(exams, null, 2)};\n`);
console.log(`完成 ${exams.length} 年、${exams.reduce((sum, exam) => sum + exam.questionCount, 0)} 題官方答案。`);
