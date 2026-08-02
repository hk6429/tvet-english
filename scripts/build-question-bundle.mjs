import { readFileSync, writeFileSync } from "node:fs";

const parts = [];
for (let year = 90; year <= 114; year += 1) {
  parts.push(readFileSync(new URL(`../data/years/questions-${year}.js`, import.meta.url), "utf8").trim());
}
parts.push(readFileSync(new URL("../data/questions-115.js", import.meta.url), "utf8").trim());

const banner = "// 由 scripts/build-question-bundle.mjs 產生，請勿手改。\n";
writeFileSync(new URL("../data/questions.js", import.meta.url), `${banner}${parts.join("\n")}\n`);
console.log("完成 90–115 共 26 年題庫 bundle。");
