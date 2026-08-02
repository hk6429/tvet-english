import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const OCR_LANGUAGES = "eng+chi_tra";

export function normalizePdfText(value) {
  return value
    .replaceAll("\u00a0", " ")
    .replaceAll("\uf0ad", " ")
    .replace(/[ˉ的]\s*$/gm, "")
    .replace(/\r/g, "");
}

function pdfPageCount(pdfPath) {
  const info = execFileSync("pdfinfo", [pdfPath], { encoding: "utf8" });
  const match = info.match(/^Pages:\s+(\d+)/m);
  if (!match) throw new Error(`無法取得 PDF 頁數：${pdfPath}`);
  return Number(match[1]);
}

function ocrPage(pdfPath, page, imageRoot) {
  mkdirSync(imageRoot, { recursive: true });
  const prefix = join(imageRoot, `page-${String(page).padStart(2, "0")}`);
  execFileSync("pdftoppm", ["-jpeg", "-r", "260", "-f", String(page), "-l", String(page), "-singlefile", pdfPath, prefix]);
  return execFileSync("tesseract", [`${prefix}.jpg`, "stdout", "-l", OCR_LANGUAGES, "--psm", "6"], { encoding: "utf8" });
}

export function extractPdfTextByPage(pdfPath, year, cacheRoot) {
  const pages = [];
  const methods = [];
  for (let page = 1; page <= pdfPageCount(pdfPath); page += 1) {
    let text = execFileSync("pdftotext", ["-layout", "-f", String(page), "-l", String(page), pdfPath, "-"], { encoding: "utf8" });
    let method = "pdftotext";
    if (text.replace(/\s/g, "").length < 100) {
      text = ocrPage(pdfPath, page, join(cacheRoot, `ocr-${year}`));
      method = "ocr";
    }
    pages.push(normalizePdfText(text).replace(/\f/g, ""));
    methods.push(method);
  }
  return { text: pages.join("\f\n"), methods };
}
