import test from "node:test";
import assert from "node:assert/strict";

import reportRoute from "../api/report.mjs";

const validPayload = {
  mode: "question",
  reason: "答案有誤",
  note: "",
  website: "",
  page: "https://tvet-english.pages.dev/?year=115",
  browser: "test-agent",
  context: {
    id: "115-1",
    year: 115,
    no: 1,
    subject: "統測英文",
    kind: "選擇題",
    category: "文字與字詞基礎",
    tags: ["字音辨識"],
    prompt: "這是一道測試題幹。",
    options: { A: "選項甲", B: "選項乙", C: "選項丙", D: "選項丁" },
    answer: "A",
    selected: "B",
    explanation: "這是測試解析。",
    source: "https://example.test/official.pdf",
  },
};

test("有效的單題回報會把完整題目上下文送往 Telegram", async () => {
  const originalFetch = global.fetch;
  const originalToken = process.env.TELEGRAM_BOT_TOKEN;
  const originalChatId = process.env.TELEGRAM_REPORT_CHAT_ID;
  let telegramRequest;
  process.env.TELEGRAM_BOT_TOKEN = "test-token";
  process.env.TELEGRAM_REPORT_CHAT_ID = "test-chat";
  global.fetch = async (url, options) => {
    telegramRequest = { url, body: JSON.parse(options.body) };
    return Response.json({ ok: true });
  };

  try {
    const response = await reportRoute.fetch(new Request("https://tvet-english.vercel.app/api/report", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://tvet-english.pages.dev",
        "x-forwarded-for": "192.0.2.1",
      },
      body: JSON.stringify(validPayload),
    }));

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), "https://tvet-english.pages.dev");
    assert.equal(telegramRequest.body.chat_id, "test-chat");
    assert.match(telegramRequest.body.text, /這是一道測試題幹/);
    assert.match(telegramRequest.body.text, /A\. 選項甲/);
    assert.match(telegramRequest.body.text, /官方答案：A/);
    assert.match(telegramRequest.body.text, /回報當下作答：B/);
    assert.match(telegramRequest.body.text, /https:\/\/example\.test\/official\.pdf/);
    assert.match(telegramRequest.body.text, /這是測試解析/);
  } finally {
    global.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = originalToken;
    if (originalChatId === undefined) delete process.env.TELEGRAM_REPORT_CHAT_ID;
    else process.env.TELEGRAM_REPORT_CHAT_ID = originalChatId;
  }
});

test("蜜罐欄位有內容時拒絕回報且不呼叫 Telegram", async () => {
  const originalFetch = global.fetch;
  let telegramCalls = 0;
  global.fetch = async () => {
    telegramCalls += 1;
    return Response.json({ ok: true });
  };
  try {
    const response = await reportRoute.fetch(new Request("https://tvet-english.vercel.app/api/report", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "192.0.2.2" },
      body: JSON.stringify({ ...validPayload, website: "spam.example" }),
    }));
    assert.equal(response.status, 400);
    assert.equal(telegramCalls, 0);
  } finally {
    global.fetch = originalFetch;
  }
});

test("允許三個正式站進行 CORS 預檢", async () => {
  for (const origin of [
    "https://tvet-english.vercel.app",
    "https://tvet-english.pages.dev",
    "https://tvet-english.netlify.app",
  ]) {
    const response = await reportRoute.fetch(new Request("https://tvet-english.vercel.app/api/report", {
      method: "OPTIONS",
      headers: { origin },
    }));
    assert.equal(response.status, 204);
    assert.equal(response.headers.get("access-control-allow-origin"), origin);
  }
});

test("五分鐘內相同題目與原因只接受一次", async () => {
  const originalFetch = global.fetch;
  const originalToken = process.env.TELEGRAM_BOT_TOKEN;
  const originalChatId = process.env.TELEGRAM_REPORT_CHAT_ID;
  let telegramCalls = 0;
  process.env.TELEGRAM_BOT_TOKEN = "test-token";
  process.env.TELEGRAM_REPORT_CHAT_ID = "test-chat";
  global.fetch = async () => {
    telegramCalls += 1;
    return Response.json({ ok: true });
  };
  const body = JSON.stringify({
    ...validPayload,
    context: { ...validPayload.context, id: "115-2", no: 2 },
  });
  const makeRequest = () => new Request("https://tvet-english.vercel.app/api/report", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "192.0.2.3" },
    body,
  });

  try {
    const first = await reportRoute.fetch(makeRequest());
    const duplicate = await reportRoute.fetch(makeRequest());
    assert.equal(first.status, 200);
    assert.equal(duplicate.status, 429);
    assert.equal(telegramCalls, 1);
  } finally {
    global.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = originalToken;
    if (originalChatId === undefined) delete process.env.TELEGRAM_REPORT_CHAT_ID;
    else process.env.TELEGRAM_REPORT_CHAT_ID = originalChatId;
  }
});
