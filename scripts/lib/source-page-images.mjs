import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

function pageCount(pdfPath) {
  const info = execFileSync("pdfinfo", [pdfPath], { encoding: "utf8" });
  const match = info.match(/^Pages:\s+(\d+)/m);
  if (!match) throw new Error(`無法取得 PDF 頁數：${pdfPath}`);
  return Number(match[1]);
}

export function locateQuestionPage(pdfPath, no) {
  const marker = new RegExp(`^\\s*${no}\\s*(?:\\.\\s*[a-z]?|[、．]|(?=\\(A\\)))\\s*`, "im");
  for (let page = 1; page <= pageCount(pdfPath); page += 1) {
    const text = execFileSync("pdftotext", ["-layout", "-f", String(page), "-l", String(page), pdfPath, "-"], { encoding: "utf8" });
    if (marker.test(text)) return page;
  }
  throw new Error(`找不到第 ${no} 題所在 PDF 頁面：${pdfPath}`);
}

export function renderSourcePage({ pdfPath, year, no, page: knownPage, outputRoot, publicRoot }) {
  const page = knownPage ?? locateQuestionPage(pdfPath, no);
  const filename = `page-${String(page).padStart(2, "0")}.png`;
  const target = join(outputRoot, filename);
  mkdirSync(dirname(target), { recursive: true });
  execFileSync("pdftoppm", ["-png", "-r", "140", "-f", String(page), "-l", String(page), "-singlefile", pdfPath, target.replace(/\.png$/, "")]);
  return { page, path: `${publicRoot}/${filename}`, year };
}
