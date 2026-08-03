const TELEGRAM_API = "https://api.telegram.org";
const SUBJECT_LABEL = "統測英文";
const QUESTION_REASONS = new Set(["題目或選項有誤", "答案有誤", "解析不清", "圖片顯示異常", "其他"]);
const GENERAL_REASONS = new Set(["操作異常", "顯示問題", "功能建議", "其他"]);
const ALLOWED_ORIGINS = new Set([
  "https://tvet-english.vercel.app",
  "https://tvet-english.pages.dev",
  "https://tvet-english.netlify.app",
  "http://localhost:4173",
]);
const duplicateReports = new Map();
const rateReports = new Map();
const DUPLICATE_WINDOW_MS = 5 * 60 * 1_000;
const RATE_WINDOW_MS = 10 * 60 * 1_000;
const RATE_LIMIT = 6;

function text(value, limit = 800) {
  return String(value ?? "").trim().slice(0, limit);
}

function corsHeaders(request) {
  const origin = request.headers.get("origin");
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    vary: "Origin",
  };
}

function json(request, body, status = 200, extraHeaders = {}) {
  return Response.json(body, { status, headers: { ...corsHeaders(request), ...extraHeaders } });
}

function formatQuestionReport(payload) {
  const context = payload.context;
  const options = Object.entries(context.options || {})
    .map(([key, value]) => `${text(key, 4)}. ${text(value, 220)}`)
    .join("\n");
  return [
    `【${SUBJECT_LABEL}題目回報】`,
    `原因：${text(payload.reason, 40)}`,
    `題目：${text(context.id, 50)}｜${text(context.year, 4)} 學年度｜${text(context.subject, 30)}｜第 ${text(context.no, 4)} 題`,
    `類型：${text(context.kind, 30)}｜${text(context.category, 50)}｜${(context.tags || []).map((tag) => text(tag, 30)).join("、")}`,
    "",
    `題幹：\n${text(context.prompt, 1_000)}`,
    options ? `選項：\n${options}` : "",
    `官方答案：${text(context.answer, 100)}`,
    context.selected ? `回報當下作答：${text(context.selected, 100)}` : "",
    `解析：\n${text(context.explanation, 1_000)}`,
    payload.note ? `補充：\n${text(payload.note, 500)}` : "",
    context.source ? `官方來源：${text(context.source, 300)}` : "",
    context.image ? `題圖：${text(context.image, 300)}` : "",
    `頁面：${text(payload.page, 400)}`,
  ].filter(Boolean).join("\n").slice(0, 4_000);
}

function formatGeneralReport(payload) {
  return [
    `【${SUBJECT_LABEL}一般問題回報】`,
    `原因：${text(payload.reason, 40)}`,
    `說明：\n${text(payload.note, 1_000)}`,
    `頁面：${text(payload.page, 400)}`,
    payload.browser ? `瀏覽器：${text(payload.browser, 300)}` : "",
  ].filter(Boolean).join("\n").slice(0, 4_000);
}

function validQuestionPayload(payload) {
  if (!payload || payload.mode !== "question" || !QUESTION_REASONS.has(payload.reason)) return false;
  if (payload.website || (payload.reason === "其他" && text(payload.note).length < 5)) return false;
  if (text(payload.note).length > 500 || text(payload.page).length > 400) return false;
  const context = payload.context;
  if (!context || typeof context !== "object") return false;
  if (!text(context.id, 51) || !Number.isInteger(context.year) || !Number.isInteger(context.no)) return false;
  if (!text(context.subject, 31) || !text(context.kind, 31) || !text(context.prompt, 1_501)) return false;
  if (!text(context.answer, 101) || !text(context.explanation, 1_501)) return false;
  if (context.options != null && (typeof context.options !== "object" || Array.isArray(context.options))) return false;
  return Object.keys(context.options || {}).length <= 6;
}

function validGeneralPayload(payload) {
  if (!payload || payload.mode !== "general" || !GENERAL_REASONS.has(payload.reason) || payload.website) return false;
  const noteLength = text(payload.note, 1_001).length;
  return noteLength >= 5 && noteLength <= 1_000
    && text(payload.page).length <= 400 && text(payload.browser).length <= 300;
}

function validPayload(payload) {
  return validQuestionPayload(payload) || validGeneralPayload(payload);
}

function clientIp(request) {
  return text(request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown", 80);
}

function duplicateKey(request, payload) {
  const item = payload.mode === "question" ? payload.context.id : text(payload.note, 120);
  return `${clientIp(request)}|${payload.mode}|${item}|${payload.reason}`;
}

function recentReports(request, now = Date.now()) {
  const ip = clientIp(request);
  const recent = (rateReports.get(ip) || []).filter((at) => now - at < RATE_WINDOW_MS);
  rateReports.set(ip, recent);
  return { ip, recent };
}

async function handle(request) {
  const origin = request.headers.get("origin");
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json(request, { ok: false, error: "不允許的來源。" }, 403);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, { ok: false, error: "僅接受 POST。" }, 405, { allow: "POST, OPTIONS" });

  const rawBody = await request.text();
  if (rawBody.length > 30_000) return json(request, { ok: false, error: "回報內容過大。" }, 413);
  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json(request, { ok: false, error: "回報資料格式不正確。" }, 400);
  }
  if (!validPayload(payload)) return json(request, { ok: false, error: "請確認回報內容後再送出。" }, 400);

  const dedupeKey = duplicateKey(request, payload);
  const previousReport = duplicateReports.get(dedupeKey);
  if (previousReport && Date.now() - previousReport < DUPLICATE_WINDOW_MS) {
    return json(request, { ok: false, error: "相同問題已收到，請勿重複送出。" }, 429);
  }
  const rate = recentReports(request);
  if (rate.recent.length >= RATE_LIMIT) return json(request, { ok: false, error: "回報次數過多，請稍後再試。" }, 429);

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_REPORT_CHAT_ID;
  if (!token || !chatId) return json(request, { ok: false, error: "回報服務尚未完成設定。" }, 503);

  let telegramResponse;
  try {
    telegramResponse = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: payload.mode === "question" ? formatQuestionReport(payload) : formatGeneralReport(payload),
      }),
    });
  } catch {
    return json(request, { ok: false, error: "回報暫時無法送出，請稍後再試。" }, 502);
  }
  if (!telegramResponse.ok) return json(request, { ok: false, error: "回報暫時無法送出，請稍後再試。" }, 502);

  duplicateReports.set(dedupeKey, Date.now());
  rateReports.set(rate.ip, [...rate.recent, Date.now()]);
  return json(request, { ok: true });
}

export default { fetch: handle };
