# 題庫資料說明

## `exams.js`

- 90–115 學年度，共 26 年、1,196 題選擇題。
- 由 `scripts/build-official-data.mjs` 直接讀取統測中心官方答案產生。
- 題數依官方題本：90–103 每年 50 題、104 年 40 題、105–110 每年 41 題、111–115 每年 42 題。

## `questions.js` 與 `years/questions-*.js`

- `questions.js` 是瀏覽器載入的 90–115 年完整 bundle，共 26 年、1,196 題。
- `years/questions-90.js` 至 `questions-114.js` 是可重建的年度分片；`questions-115.js` 保留 115 年專用產線與測試相容性。
- 90–109 年取自官方 PDF；110–115 年以官方 DOCX 為主、官方 PDF 補足空格與圖像。
- 純掃描或缺文字層頁面以 Tesseract 初步辨識，再用 `scripts/lib/manual-corrections-*.mjs` 保存逐頁人工校正。
- 第 31–32、33–35 題使用 `img/115/` 的官方 PDF 圖表裁切。
- 分類採 6 大標／32 個真題小標，控制規則見 `docs/curriculum-taxonomy.md`。

## `source-audit.json`

- 記錄 26 年官方 PDF／DOCX 來源、解析方式、預期題數、實得題數與答案驗證狀態。
- 重新執行 `npm run build:questions:all` 時先更新；任何年度題號缺漏都會讓產線失敗。

## `metrics.mjs`

- 收錄 115 年官方試題研討會難度、鑑別度交叉表，兩個維度都完整覆蓋 42 題。
- 官方沒有逐題公開的精確數值不自行反推。

## `insights-115.mjs`

- `QUESTION_INSIGHTS_115` 是本站教師版自編解析，不冒充官方解答說明。
- `OFFICIAL_OPTION_STATS_115` 只收錄研討會題例頁明確公布的 9 題 P 值、D 值與選項分布。
