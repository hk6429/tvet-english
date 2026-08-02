import { OFFICIAL_METRICS } from "./data/metrics.mjs?v=20260802-v1";
import { OFFICIAL_OPTION_STATS_115, QUESTION_INSIGHTS_115 } from "./data/insights-115.mjs?v=20260802-v1";
import { acceptedAnswers } from "./practice-core.mjs?v=20260802-v1";

const exams = [...window.EXAMS].sort((a, b) => b.year - a.year);
const questionBanks = window.QUESTION_BANK ?? [];
const categories = { C1: "字彙與語意", C2: "文法與句構", C3: "溝通功能與情境", C4: "篇章組織與連貫", C5: "資訊擷取與整合", C6: "推論評鑑與思辨" };
const readProcess = { C1: "字詞理解", C2: "句構理解", C3: "情境溝通", C4: "篇章連貫", C5: "資訊整合", C6: "推論思辨" };
const yearSelect = document.getElementById("checkYear");
const numberInput = document.getElementById("checkNo");
const result = document.getElementById("checkResult");

yearSelect.innerHTML = exams.map((exam) => `<option value="${exam.year}">${exam.year} 學年度</option>`).join("");
const requestedYear = Number(new URLSearchParams(location.search).get("year"));
if (exams.some((exam) => exam.year === requestedYear)) yearSelect.value = String(requestedYear);
const requestedNo = Number(new URLSearchParams(location.search).get("no"));
if (Number.isInteger(requestedNo) && requestedNo > 0) numberInput.value = String(requestedNo);

function selectedExam() { return exams.find((exam) => exam.year === Number(yearSelect.value)); }
function escapeHtml(value = "") { return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]); }
function selectedQuestion(year, no) { return questionBanks.find((bank) => bank.year === year)?.questions.find((question) => question.no === no); }
function answerLabel(answer) {
  if (answer === "送分") return "送分題（A–D 皆計分）";
  if (answer.includes("、")) return `${answer}（雙答案）`;
  return answer;
}
function statsChartHtml(no, answer, group = "all") {
  const stats = OFFICIAL_OPTION_STATS_115[no];
  if (!stats) return "";
  const accepted = acceptedAnswers(answer);
  return `<div class="option-stat-rows">${["A", "B", "C", "D"].map((choice) => `<div class="option-stat-row"><span>(${choice})${accepted.includes(choice) ? " ✓正解" : ""}</span><div><i style="width:${stats[group][choice]}%" class="${accepted.includes(choice) ? "correct" : ""}"></i></div><b>${stats[group][choice].toFixed(1)}%</b></div>`).join("")}</div>`;
}
function officialStatsHtml(no, answer) {
  const stats = OFFICIAL_OPTION_STATS_115[no];
  if (!stats) return `<p class="stats-unavailable">本題官方未公開選項百分比分布；本站不自行推算。</p>`;
  return `<div class="official-stats" data-check-stats="${no}"><div class="official-source-label">官方公布資料</div><div class="stats-head"><b class="stats-title">全體考生作答分布（統測中心試題研討會）</b><span><button type="button" data-check-group="all" class="active" aria-pressed="true">全體</button><button type="button" data-check-group="low" aria-pressed="false">待加強組</button></span></div><div class="stats-chart">${statsChartHtml(no, answer)}</div></div>`;
}
function updateLinks() {
  const exam = selectedExam();
  numberInput.max = exam.questionCount;
  document.getElementById("checkQuestionLink").href = exam.questionUrl;
  document.getElementById("checkAnswerLink").href = exam.answerUrl;
  result.hidden = true;
}

function showAnswer() {
  const exam = selectedExam();
  const no = Number(numberInput.value);
  const error = document.getElementById("checkError");
  if (!Number.isInteger(no) || no < 1 || no > exam.questionCount) {
    error.textContent = `請輸入 1–${exam.questionCount} 的題號。`;
    error.hidden = false;
    numberInput.setAttribute("aria-invalid", "true");
    result.hidden = true;
    numberInput.focus();
    return;
  } else {
    error.hidden = true;
    numberInput.removeAttribute("aria-invalid");
    const question = selectedQuestion(exam.year, no);
    if (!question) {
      result.innerHTML = `<strong>${exam.year} 學年度第 ${no} 題：${answerLabel(exam.answers[no - 1])}</strong><p>答案取自技專校院入學測驗中心官方公告；請搭配官方原卷核對題文。</p>`;
    } else {
      const bank = questionBanks.find((item) => item.year === exam.year);
      const group = question.group ? bank?.groups[question.group] : null;
      const accepted = acceptedAnswers(question.answer);
      const metric = OFFICIAL_METRICS[exam.year]?.items[no];
      const groupMaterial = group?.passage || group?.image
        ? `<details class="source-passage" open><summary>${escapeHtml(group.title)}</summary>${group.passage ?? ""}${group.image ? `<img class="source-figure" src="${escapeHtml(group.image)}" alt="第 ${question.group.slice(1).replace("_", "–")} 題官方圖表">` : ""}</details>`
        : "";
      result.innerHTML = `<article class="question-card check-question"><div class="question-meta"><span>統測 ${exam.year} 年第 ${no} 題</span><span class="question-tag cat-${question.cat}">${escapeHtml(categories[question.cat] ?? question.cat)}</span>${(question.tags ?? []).map((tag) => `<span class="question-tag">${escapeHtml(tag)}</span>`).join("")}${readProcess[question.cat] ? `<span class="question-tag process-tag">${readProcess[question.cat]}</span>` : ""}</div>${groupMaterial}${question.passage ? `<details class="source-passage" open><summary>本題附加材料</summary>${question.passage}</details>` : ""}<fieldset><legend><span>${no}.</span> ${escapeHtml(question.stem)}</legend><div class="question-options">${["A", "B", "C", "D"].map((choice) => `<div class="question-option ${accepted.includes(choice) ? "is-correct" : ""}"><span class="option-letter">${choice}</span><span>${escapeHtml(question.options[choice])}</span></div>`).join("")}</div></fieldset><div class="question-feedback"><p class="feedback-status is-correct">✓ 官方答案：${escapeHtml(answerLabel(question.answer))}</p><div class="explanation"><span class="explain-label">本站自編解析（非官方）</span><b>解題關鍵</b><p>${QUESTION_INSIGHTS_115[no]?.explain ?? "請參照官方答案。"}</p></div>${metric ? `<p class="metric-badges"><span>難度：${metric.difficulty}</span><span>鑑別度：${metric.discrimination}</span></p>` : ""}${officialStatsHtml(no, question.answer)}</div></article>`;
    }
  }
  result.hidden = false;
  history.replaceState(null, "", `?year=${exam.year}&no=${no}`);
  result.focus({ preventScroll: true });
  result.scrollIntoView({ behavior: "smooth", block: "start" });
}

document.getElementById("checkForm").addEventListener("submit", (event) => { event.preventDefault(); showAnswer(); });
result.addEventListener("click", (event) => {
  const button = event.target.closest("[data-check-group]");
  if (!button) return;
  const no = Number(result.querySelector("[data-check-stats]")?.dataset.checkStats);
  const question = selectedQuestion(Number(yearSelect.value), no);
  result.querySelectorAll("[data-check-group]").forEach((candidate) => {
    const active = candidate === button;
    candidate.classList.toggle("active", active);
    candidate.setAttribute("aria-pressed", String(active));
  });
  result.querySelector(".stats-chart").innerHTML = statsChartHtml(no, question.answer, button.dataset.checkGroup);
  result.querySelector(".stats-title").textContent = `${button.dataset.checkGroup === "low" ? "待加強組" : "全體考生"}作答分布（統測中心試題研討會）`;
});

yearSelect.addEventListener("change", updateLinks);
updateLinks();
if (Number.isInteger(requestedNo) && requestedNo > 0) showAnswer();
