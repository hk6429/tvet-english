const API_URL = ["tvet-english.pages.dev", "localhost", "127.0.0.1"].includes(location.hostname)
  ? "/api/report"
  : "https://tvet-english.pages.dev/api/report";
const QUESTION_REASONS = ["題目或選項有誤", "答案有誤", "解析不清", "圖片顯示異常", "其他"];
const GENERAL_REASONS = ["操作異常", "顯示問題", "功能建議", "其他"];

const launcher = document.createElement("button");
launcher.id = "generalReportBtn";
launcher.className = "report-launch";
launcher.type = "button";
launcher.textContent = "回報網站問題";

const dialog = document.createElement("dialog");
dialog.id = "reportDialog";
dialog.className = "report-dialog";
dialog.setAttribute("aria-labelledby", "reportTitle");
dialog.innerHTML = `
  <form id="reportForm">
    <div class="report-head">
      <div><p class="section-label">協助我們改善題庫</p><h2 id="reportTitle">回報問題</h2></div>
      <button class="report-close" id="reportCloseBtn" type="button" aria-label="關閉回報表單">×</button>
    </div>
    <p id="reportContextLabel" class="report-context"></p>
    <label for="reportReason"><b>問題類型</b></label>
    <select id="reportReason" required></select>
    <label for="reportNote"><b>補充說明</b> <span id="reportNoteHint">（選填）</span></label>
    <textarea id="reportNote" maxlength="1000" rows="4" placeholder="若方便，請描述你看到的情況。"></textarea>
    <label class="report-trap" aria-hidden="true">網站<input id="reportWebsite" type="text" tabindex="-1" autocomplete="off"></label>
    <p id="reportStatus" class="report-status" role="status" aria-live="polite"></p>
    <div class="report-actions">
      <button class="secondary" id="reportCancelBtn" type="button">取消</button>
      <button class="primary" id="reportSubmitBtn" type="submit">送出回報</button>
    </div>
  </form>`;
document.body.append(launcher, dialog);

const form = dialog.querySelector("#reportForm");
const reasonSelect = dialog.querySelector("#reportReason");
const noteInput = dialog.querySelector("#reportNote");
const noteHint = dialog.querySelector("#reportNoteHint");
const contextLabel = dialog.querySelector("#reportContextLabel");
const status = dialog.querySelector("#reportStatus");
const submitButton = dialog.querySelector("#reportSubmitBtn");
let mode = "general";
let currentContext = null;

function setReasons(reasons) {
  reasonSelect.replaceChildren(...reasons.map((reason) => new Option(reason, reason)));
  updateNoteRequirement();
}

function updateNoteRequirement() {
  const required = mode === "general" || reasonSelect.value === "其他";
  noteInput.required = required;
  noteInput.minLength = required ? 5 : 0;
  noteHint.textContent = required ? "（至少 5 個字）" : "（選填）";
}

function openDialog() {
  status.textContent = "";
  status.className = "report-status";
  dialog.showModal();
  reasonSelect.focus();
}

function openQuestion(context) {
  mode = "question";
  currentContext = context;
  form.reset();
  setReasons(QUESTION_REASONS);
  contextLabel.textContent = `${context.year} 學年度・第 ${context.no} 題｜${context.prompt.slice(0, 80)}`;
  openDialog();
}

function openGeneral() {
  mode = "general";
  currentContext = null;
  form.reset();
  setReasons(GENERAL_REASONS);
  contextLabel.textContent = "無法定位到單一題目時，可在這裡回報網站操作或顯示問題。";
  openDialog();
}

async function submit(event) {
  event.preventDefault();
  if (!form.reportValidity()) return;
  submitButton.disabled = true;
  status.className = "report-status";
  status.textContent = "正在送出……";
  const payload = {
    mode,
    reason: reasonSelect.value,
    note: noteInput.value.trim(),
    website: dialog.querySelector("#reportWebsite").value,
    page: location.href,
    browser: navigator.userAgent,
    ...(mode === "question" ? { context: currentContext } : {}),
  };

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "回報暫時無法送出，請稍後再試。");
    status.className = "report-status ok";
    status.textContent = "已收到，謝謝你協助改善題庫。";
    form.reset();
    setTimeout(() => dialog.close(), 1_200);
  } catch (error) {
    status.className = "report-status bad";
    status.textContent = error.message || "回報暫時無法送出，請稍後再試。";
  } finally {
    submitButton.disabled = false;
  }
}

launcher.addEventListener("click", openGeneral);
reasonSelect.addEventListener("change", updateNoteRequirement);
form.addEventListener("submit", submit);
dialog.querySelector("#reportCloseBtn").addEventListener("click", () => dialog.close());
dialog.querySelector("#reportCancelBtn").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });

window.TvetReport = { openQuestion, openGeneral };
