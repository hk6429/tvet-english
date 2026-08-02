import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

export const ROOT = "https://web1.tcte.edu.tw/EXAM";
export const CACHE_DIR = fileURLToPath(new URL("../../.cache/official/", import.meta.url));

export function padYear(year) {
  return String(year).padStart(3, "0");
}

export function expectedQuestionCount(year) {
  if (year <= 103) return 50;
  if (year === 104) return 40;
  if (year <= 110) return 41;
  return 42;
}

export function officialPage(year) {
  return `${ROOT}/${padYear(year)}_4y/`;
}

export function downloaderUrl(year, filename) {
  return `${officialPage(year)}downloader.php?obj=${Buffer.from(filename).toString("base64")}`;
}

export function questionPdfUrl(year) {
  if (year === 90) return `${officialPage(year)}p_e.pdf`;
  if (year <= 94) return `${officialPage(year)}${year}-4y-00-e.pdf`;
  return downloaderUrl(year, `${year}-4y-00-e.pdf`);
}

export function questionDocxUrl(year) {
  return year >= 110 ? downloaderUrl(year, `${year}-4y-00-e.docx`) : null;
}

export async function downloadFile(url, target) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, bytes);
  return bytes;
}

export async function cachedQuestionPdf(year) {
  const target = join(CACHE_DIR, `${year}.pdf`);
  try {
    if (readFileSync(target).length > 1000) return target;
  } catch {}
  await downloadFile(questionPdfUrl(year), target);
  return target;
}

export async function cachedQuestionDocx(year) {
  const url = questionDocxUrl(year);
  if (!url) return null;
  const target = join(CACHE_DIR, `${year}.docx`);
  try {
    if (readFileSync(target).length > 1000) return target;
  } catch {}
  await downloadFile(url, target);
  return target;
}

export function loadOfficialExams() {
  const context = { window: {} };
  const source = readFileSync(new URL("../../data/exams.js", import.meta.url), "utf8");
  vm.runInNewContext(source, context);
  return context.window.EXAMS;
}
