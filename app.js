import { difficultyRank, matchingNumbers, OFFICIAL_METRICS } from "./data/metrics.mjs?v=20260802-v1";
import { OFFICIAL_OPTION_STATS_115, QUESTION_INSIGHTS_115 } from "./data/insights-115.mjs?v=20260802-v1";
import { acceptedAnswers, clampQuestionCount, gradeItems, makeItems, makeItemsFromCandidates, makeItemsFromNumbers, mergeWrongBook } from "./practice-core.mjs?v=20260802-v1";

const $ = (id) => document.getElementById(id);
const exams = [...window.EXAMS].sort((a, b) => b.year - a.year);
const WRONG_KEY = "tvetEnglish:wrongBook";
const HISTORY_KEY = "tvetEnglish:history";
const WRONG_REASON_KEY = "tvetEnglish:wrongReasons";
const CATEGORIES = {
  C1: "字彙與語意",
  C2: "文法與句構",
  C3: "溝通功能與情境",
  C4: "篇章組織與連貫",
  C5: "資訊擷取與整合",
  C6: "推論評鑑與思辨",
};
const SUBCATEGORIES = {
  C1: ["語境選字", "同義字辨識", "搭配詞運用"],
  C2: ["介系詞運用", "連接詞運用", "分詞結構"],
  C3: ["情境對話", "日常購物", "休閒娛樂", "節慶文化", "終身學習", "健康安全", "家庭協作", "技職競賽", "求職表達", "公民生活", "人物與環境"],
  C4: ["段落語意", "結尾統整"],
  C5: ["明示訊息", "後續推測", "趨勢判讀", "資訊整合", "圖表判讀", "反向細節", "時序重組"],
  C6: ["結論判斷", "資訊整合", "因果推論", "主旨判斷", "反向細節", "語意推論", "事實判斷"],
};
const CATEGORY_AXES = { C1: "官方：語言知識", C2: "官方：語言知識", C3: "官方：溝通功能", C4: "官方：思考能力", C5: "官方：思考能力", C6: "官方：思考能力" };
const READ_PROCESS = { C1: "字詞理解", C2: "句構理解", C3: "情境溝通", C4: "篇章連貫", C5: "資訊整合", C6: "推論思辨" };
const questionBanks = window.QUESTION_BANK ?? [];
const activeSubcategories = new Set(Object.entries(SUBCATEGORIES).flatMap(([cat, tags]) => tags.map((tag) => `${cat}::${tag}`)));
let activeExam = exams[0];
const selectedYears = new Set([exams[0].year]);
let lastQuickSignature = "";
let sessionItems = [];
let sessionMode = "practice";
let timerId;
let remainingSeconds = 0;
let startedAt = 0;
let teacherItems = [];
let teacherSelection = new Set();
let sessionSubmitted = false;
let announcedTimes = new Set();

function safeRead(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

function safeWrite(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch {
    const warning = $("storageWarning");
    if (warning) warning.hidden = false;
    return false;
  }
}

function storageKey(year) { return `tvetEnglish:${year}`; }
function itemKey(item) { return `${item.year}-${item.no}`; }
function findExam(year) { return exams.find((exam) => exam.year === Number(year)); }
function findQuestionBank(year) { return questionBanks.find((bank) => bank.year === Number(year)); }
function findQuestion(year, no) { return findQuestionBank(year)?.questions.find((question) => question.no === Number(no)); }
function plainText(value = "") {
  const node = document.createElement("div");
  node.innerHTML = String(value);
  return node.textContent.replace(/\s+/g, " ").trim();
}
function questionReportContext(item) {
  const question = item.question;
  const bank = findQuestionBank(item.year);
  const group = question?.group ? bank?.groups[question.group] : null;
  const material = [group?.passage, question?.passage].map(plainText).filter(Boolean).join("\n");
  const stem = question?.stem || `本站目前只顯示官方答案卡，請搭配官方題本核對第 ${item.no} 題。`;
  return {
    id: `${item.year}-${item.no}`,
    year: item.year,
    no: item.no,
    subject: "統測英文",
    kind: question ? "選擇題" : "答案卡",
    category: question ? (CATEGORIES[question.cat] ?? question.cat) : "尚未結構化",
    tags: question?.tags ?? [],
    prompt: material ? `${material}\n\n${stem}` : stem,
    options: question?.options ?? {},
    answer: item.answer,
    selected: savedAnswer(item),
    explanation: question?.explain ?? (item.year === 115 ? QUESTION_INSIGHTS_115[item.no]?.explain : null) ?? "本站尚未完成本題逐題解析。",
    source: findExam(item.year)?.questionUrl ?? "",
    image: question?.sourcePageImage ?? group?.image ?? "",
  };
}
function escapeHtml(value = "") { return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]); }
function announce(message) { $("sessionAnnouncement").textContent = message; }
function focusPanel(element) { element.setAttribute("tabindex", "-1"); element.focus({ preventScroll: true }); }
function restoreMoreActionFocus(id) {
  if ($("moreActions").hidden) {
    $("moreActions").hidden = false;
    $("moreToggle").setAttribute("aria-expanded", "true");
    $("moreToggle").textContent = "收起功能⌃";
  }
  $(id).focus();
}
function requiresOfficialFigure(question, year) {
  if (!question) return false;
  const group = question.group ? findQuestionBank(year)?.groups[question.group] : null;
  return Boolean(question.sourcePageImage)
    || Object.values(question.options).some((option) => option.includes("圖像選項"))
    || String(question.passage ?? "").includes("官方圖表")
    || String(group?.passage ?? "").includes("source-image-note");
}

function renderYearOptions() {
  $("yearOptions").innerHTML = exams.map((exam) => `<label><input type="checkbox" value="${exam.year}" ${selectedYears.has(exam.year) ? "checked" : ""}><span>${exam.year} 學年度</span></label>`).join("");
  updateYearMeta();
}

function selectedExams() { return exams.filter((exam) => selectedYears.has(exam.year)); }
function setSelectedYears(years) {
  selectedYears.clear();
  for (const year of years) selectedYears.add(Number(year));
  $("yearOptions").querySelectorAll('input[type="checkbox"]').forEach((input) => { input.checked = selectedYears.has(Number(input.value)); });
  updateYearMeta();
}

function secureRandom() {
  if (!globalThis.crypto?.getRandomValues) return Math.random();
  const value = new Uint32Array(1);
  globalThis.crypto.getRandomValues(value);
  return value[0] / 4294967296;
}

function renderCategoryOptions() {
  $("categoryOptions").innerHTML = `<div class="category-guide"><span>先看大標，再勾選大標下方的小標</span><button id="categoryAllToggle" class="text-button" type="button">全部全選／清除</button></div>${Object.entries(CATEGORIES).map(([code, label]) => `<section class="category-group cat-${code}" data-cat="${code}"><div class="category-main"><span class="category-dot" aria-hidden="true"></span><strong><small>大標・${CATEGORY_AXES[code]}</small>${label}</strong><span class="category-actions"><button type="button" class="category-select" data-cat-action="all">小標全選</button><button type="button" class="category-select" data-cat-action="none">小標清除</button></span><button type="button" class="category-detail-toggle" aria-expanded="true">收合小標⌃</button></div><div class="category-tag-list"><b>小標</b>${SUBCATEGORIES[code].map((tag) => `<label><input type="checkbox" value="${code}::${tag}" checked><span>${tag}</span></label>`).join("")}</div></section>`).join("")}`;
  $("categoryOptions").addEventListener("change", (event) => {
    if (!event.target.matches('input[type="checkbox"]')) return;
    if (event.target.checked) activeSubcategories.add(event.target.value);
    else activeSubcategories.delete(event.target.value);
    updateYearMeta();
  });
  $("categoryOptions").addEventListener("click", (event) => {
    const detailButton = event.target.closest(".category-detail-toggle");
    if (detailButton) {
      const list = detailButton.closest(".category-group").querySelector(".category-tag-list");
      list.hidden = !list.hidden;
      detailButton.setAttribute("aria-expanded", String(!list.hidden));
      detailButton.textContent = list.hidden ? "展開小標⌄" : "收合小標⌃";
      return;
    }
    const actionButton = event.target.closest("[data-cat-action]");
    if (actionButton) {
      const section = actionButton.closest(".category-group");
      const checked = actionButton.dataset.catAction === "all";
      section.querySelectorAll('input[type="checkbox"]').forEach((input) => {
        input.checked = checked;
        if (checked) activeSubcategories.add(input.value);
        else activeSubcategories.delete(input.value);
      });
      updateYearMeta();
      return;
    }
    if (event.target.id === "categoryAllToggle") {
      const shouldSelectAll = activeSubcategories.size !== Object.values(SUBCATEGORIES).flat().length;
      $("categoryOptions").querySelectorAll('input[type="checkbox"]').forEach((input) => { input.checked = shouldSelectAll; });
      activeSubcategories.clear();
      if (shouldSelectAll) Object.entries(SUBCATEGORIES).forEach(([cat, tags]) => tags.forEach((tag) => activeSubcategories.add(`${cat}::${tag}`)));
      updateYearMeta();
    }
  });
}

function updateMetricControls() {
  const metrics = selectedYears.size === 1 ? OFFICIAL_METRICS[activeExam.year] : null;
  for (const id of ["difficultySelect", "discriminationSelect", "easyFirstToggle"]) $(id).disabled = !metrics;
  if (!metrics) {
    $("difficultySelect").value = "全部";
    $("discriminationSelect").value = "全部";
    $("easyFirstToggle").checked = false;
  }
  $("metricSourceLink").hidden = !metrics;
  if (metrics) $("metricSourceLink").href = metrics.source;
}

function filteredNumbersForExam(exam) {
  const metrics = selectedYears.size === 1 ? OFFICIAL_METRICS[exam.year] : null;
  const bank = selectedYears.size === 1 ? findQuestionBank(exam.year) : null;
  let numbers = bank
    ? bank.questions.filter((question) => (question.tags ?? []).some((tag) => activeSubcategories.has(`${question.cat}::${tag}`))).map((question) => question.no)
    : Array.from({ length: exam.questionCount }, (_, index) => index + 1);
  if (metrics) {
    const metricMatches = new Set(matchingNumbers(exam.year, $("difficultySelect").value, $("discriminationSelect").value));
    numbers = numbers.filter((no) => metricMatches.has(no));
  }
  if ($("easyFirstToggle").checked) {
    numbers.sort((a, b) => difficultyRank(metrics.items[a].difficulty) - difficultyRank(metrics.items[b].difficulty) || a - b);
  }
  return numbers;
}


function filteredCandidates() {
  return selectedExams().flatMap((exam) => filteredNumbersForExam(exam).map((no) => ({ exam, no })));
}

function updateYearMeta() {
  const chosen = selectedExams();
  activeExam = chosen[0] ?? exams[0];
  updateMetricControls();
  const bank = chosen.length === 1 ? findQuestionBank(activeExam.year) : null;
  $("categoryFilter").disabled = !bank;
  $("categoryFilter").hidden = !bank;
  $("categoryUnavailable").hidden = Boolean(bank);
  const matches = filteredCandidates();
  $("questionCount").max = matches.length;
  $("questionCount").value = matches.length ? clampQuestionCount($("questionCount").value, matches.length) : 0;
  const count = matches.length ? clampQuestionCount($("questionCount").value, matches.length) : 0;
  const randomText = $("randomToggle").checked ? "隨機抽題號" : "依題號順序";
  const coverage = !chosen.length ? "請至少選擇一個年度" : chosen.length > 1 ? `已合併 ${chosen.length} 個年度` : bank
    ? "題幹、選項與本站大／小分類已結構化"
    : (OFFICIAL_METRICS[activeExam.year] ? "已載入官方難度與鑑別度；題文待結構化" : "本年度尚無完整逐題統計，統計篩選停用");
  $("yearMeta").textContent = `符合條件共 ${matches.length} 題；本次 ${count} 題・${randomText}。${coverage}。`;
  const selectedCategoryCount = new Set([...activeSubcategories].map((key) => key.split("::")[0])).size;
  const yearText = chosen.length === exams.length ? `全部 ${exams.length} 年` : chosen.length > 1 ? chosen.map((exam) => exam.year).join("、") : chosen[0] ? `${chosen[0].year}` : "尚未選擇";
  $("yearSummary").textContent = chosen.length === exams.length ? `全部 ${exams.length} 個年度` : chosen.length > 1 ? `已選 ${chosen.length} 個年度` : chosen[0] ? `${chosen[0].year} 學年度` : "請選擇學年度";
  $("filterSummary").textContent = `年份 ${yearText}・分類 ${bank ? `${selectedCategoryCount}/${Object.keys(CATEGORIES).length} 類` : "不套用"}・每次 ${count} 題・${randomText}・難度 ${$("difficultySelect").value}・鑑別度 ${$("discriminationSelect").value}`;
  for (const id of ["questionCount", "startButton"]) $(id).disabled = !matches.length;
  for (const id of ["teacherButton", "mockButton", "rankButton"]) $(id).disabled = chosen.length !== 1 || !matches.length;
}

function savedAnswer(item) {
  return safeRead(storageKey(item.year), {})[item.no];
}

function clearStoredAnswers(items) {
  for (const year of new Set(items.map((item) => item.year))) {
    const saved = safeRead(storageKey(year), {});
    for (const item of items.filter((candidate) => candidate.year === year)) delete saved[item.no];
    safeWrite(storageKey(year), saved);
  }
}

function saveResponses(responses) {
  const years = new Set(sessionItems.map((item) => item.year));
  for (const year of years) {
    const current = safeRead(storageKey(year), {});
    for (const item of sessionItems.filter((candidate) => candidate.year === year)) {
      const value = responses[itemKey(item)];
      if (value) current[item.no] = value;
      else delete current[item.no];
    }
    safeWrite(storageKey(year), current);
  }
}

function renderAnswerGrid() {
  const multipleYears = new Set(sessionItems.map((item) => item.year)).size > 1;
  const renderedGroups = new Set();
  $("answerGrid").classList.toggle("structured", sessionItems.every((item) => item.question));
  $("answerGrid").innerHTML = sessionItems.map((item) => {
    const key = itemKey(item);
    const saved = savedAnswer(item);
    const question = item.question;
    const choices = ["A", "B", "C", "D"].map((choice) => question ? `
      <label class="question-option"><input type="radio" name="item-${key}" data-key="${key}" value="${choice}" aria-label="第 ${item.no} 題選項 ${choice}" ${saved === choice ? "checked" : ""}><span class="option-letter">${choice}</span><span>${escapeHtml(question.options[choice])}</span></label>
    ` : `
      <label class="choice"><input type="radio" name="item-${key}" data-key="${key}" value="${choice}" ${saved === choice ? "checked" : ""}><span>${choice}</span></label>
    `).join("");
    if (!question) return `<fieldset class="answer-row"><legend>${multipleYears ? key : item.no}</legend>${choices}<button class="report-question-btn" data-report-key="${key}" type="button">回報本題問題</button></fieldset>`;
    const bank = findQuestionBank(item.year);
    const group = question.group ? bank?.groups[question.group] : null;
    let groupMaterial = "";
    const groupKey = `${item.year}-${question.group}`;
    if ((group?.passage || group?.image) && !renderedGroups.has(groupKey)) {
      renderedGroups.add(groupKey);
      groupMaterial = `<details class="source-passage" id="passage-${groupKey}" open><summary>${escapeHtml(group.title)}</summary>${group.passage ?? ""}${group.image ? `<img class="source-figure" src="${escapeHtml(group.image)}" alt="${item.year} 年第 ${question.group.slice(1).replace("_", "–")} 題官方圖表">` : ""}</details>`;
    } else if (group?.passage || group?.image) {
      groupMaterial = `<a class="passage-jump" href="#passage-${groupKey}">↑ 回看本題組材料</a>`;
    }
    const sourceMaterial = `${groupMaterial}${question.passage ? `<details class="source-passage" open><summary>本題附加材料</summary>${question.passage}</details>` : ""}${question.sourcePageImage ? `<details class="source-passage source-page" open><summary>本題官方原卷圖</summary><img class="source-figure" src="${escapeHtml(question.sourcePageImage)}" alt="${item.year} 年第 ${item.no} 題官方原卷頁面"></details>` : ""}`;
    const meta = `<div class="question-meta"><span>統測 ${item.year} 年第 ${item.no} 題</span><span class="question-tag cat-${question.cat}">${CATEGORIES[question.cat] ?? question.cat}</span>${(question.tags ?? []).map((tag) => `<span class="question-tag">${escapeHtml(tag)}</span>`).join("")}${READ_PROCESS[question.cat] ? `<span class="question-tag process-tag">${READ_PROCESS[question.cat]}</span>` : ""}<span class="question-state" id="state-${key}">尚未作答</span></div>`;
    return `<article class="question-card" data-key="${key}">${meta}${sourceMaterial}<fieldset><legend><span>${item.no}.</span> ${escapeHtml(question.stem)}</legend><div class="question-options">${choices}</div></fieldset><div class="question-feedback" id="feedback-${key}" hidden aria-live="polite"></div><button class="report-question-btn" data-report-key="${key}" type="button">回報本題問題</button></article>`;
  }).join("");
  updateAnsweredCount();
  const saved = collectAnswers();
  if (Object.keys(saved).length) renderQuestionFeedback(saved);
}

function renderSourceLinks() {
  const years = [...new Set(sessionItems.map((item) => item.year))];
  const links = years.length > 1 ? years.map((year) => {
    const exam = findExam(year);
    return `<a class="button-link secondary" href="${exam.questionUrl}" target="_blank" rel="noopener">${year} 官方題本${exam.questionFormat === "zip" ? "（ZIP）" : ""}</a>`;
  }).join("") : "";
  $("sourceLinks").innerHTML = links;
  $("questionLink").hidden = years.length !== 1;
  if (years.length === 1) $("questionLink").href = findExam(years[0]).questionUrl;
}

function updateAnsweredCount() {
  const answered = $("answerForm").querySelectorAll("input:checked").length;
  const total = sessionItems.length || 1;
  $("answeredCount").textContent = answered;
  $("progressText").textContent = `已完成 ${answered}／${sessionItems.length} 題`;
  $("answerProgress").max = total;
  $("answerProgress").value = answered;
}

function startTimer(seconds) {
  clearInterval(timerId);
  announcedTimes = new Set();
  if (!seconds) { $("timer").textContent = "不計時"; return; }
  remainingSeconds = seconds;
  const tick = () => {
    const min = String(Math.floor(Math.max(remainingSeconds, 0) / 60)).padStart(2, "0");
    const sec = String(Math.max(remainingSeconds, 0) % 60).padStart(2, "0");
    $("timer").textContent = `${min}:${sec}`;
    if ([300, 60, 30, 10].includes(remainingSeconds) && !announcedTimes.has(remainingSeconds)) {
      announcedTimes.add(remainingSeconds);
      announce(`作答時間剩下 ${remainingSeconds >= 60 ? `${remainingSeconds / 60} 分鐘` : `${remainingSeconds} 秒`}`);
    }
    if (remainingSeconds <= 0) { clearInterval(timerId); grade(); return; }
    remainingSeconds -= 1;
  };
  tick();
  timerId = setInterval(tick, 1000);
}

function beginSession(items, mode, title) {
  if (!items.length) return;
  sessionItems = items.map((item) => ({ ...item, question: findQuestion(item.year, item.no) }));
  clearStoredAnswers(sessionItems);
  sessionMode = mode;
  sessionSubmitted = false;
  startedAt = Date.now();
  $("workspace").hidden = false;
  $("answerForm").querySelector(".submit").disabled = false;
  $("clearButton").disabled = false;
  $("paperTitle").textContent = title;
  const fullyStructured = sessionItems.every((item) => item.question);
  $("workspace").classList.toggle("structured-workspace", fullyStructured);
  $("formatNotice").textContent = mode === "wrong"
    ? "錯題本只保存年度與題號，請搭配各年度官方原卷訂正。"
    : fullyStructured
      ? "本卷題幹與選項取自官方原卷；遇到圖表提示時，請開啟官方題本核對完整圖像。"
      : `請開啟官方原卷，作答本次題號：${items.map((item) => `${item.year}-${item.no}`).join("、")}`;
  renderSourceLinks();
  renderAnswerGrid();
  $("result").hidden = true;
  const timedSeconds = $("timedToggle").checked ? items.length * 100 : 0;
  startTimer(timedSeconds);
  $("workspace").scrollIntoView({ behavior: "smooth", block: "start" });
  focusPanel($("paperTitle"));
  announce(`${title}已開始，共 ${items.length} 題。`);
}

function startPractice() {
  updateYearMeta();
  const items = makeItemsFromCandidates(filteredCandidates(), $("questionCount").value, $("randomToggle").checked);
  beginSession(items, "practice", `${selectedYears.size > 1 ? `跨 ${selectedYears.size} 個年度` : `${activeExam.year} 學年度`}・${items.length} 題練習`);
}

function startQuickPractice() {
  $("questionCount").value = 10;
  $("randomToggle").checked = true;
  $("difficultySelect").value = "全部";
  $("discriminationSelect").value = "全部";
  for (const input of $("categoryOptions").querySelectorAll("input")) input.checked = true;
  activeSubcategories.clear();
  Object.entries(SUBCATEGORIES).forEach(([cat, tags]) => tags.forEach((tag) => activeSubcategories.add(`${cat}::${tag}`)));
  updateYearMeta();
  const directCandidates = filteredCandidates().filter(({ exam, no }) => {
    const question = findQuestion(exam.year, no);
    return question && !requiresOfficialFigure(question, exam.year);
  });
  if (!directCandidates.length) {
    showInfo("所選年度尚無可直接作答的題目", "請加入已完成題幹與選項結構化的年度；本站不會用推測內容代替官方原題。");
    return;
  }
  let items;
  const previousSignature = lastQuickSignature;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    items = makeItemsFromCandidates(directCandidates, 10, true, secureRandom);
    const signature = items.map(itemKey).join(",");
    if (signature !== previousSignature || directCandidates.length <= 10) break;
  }
  if (items.map(itemKey).join(",") === previousSignature && directCandidates.length > items.length) {
    const selected = new Set(items.map(itemKey));
    const replacement = directCandidates.find(({ exam, no }) => !selected.has(`${exam.year}-${no}`));
    items = [...items.slice(0, -1), makeItemsFromCandidates([replacement], 1, false)[0]];
  }
  lastQuickSignature = items.map(itemKey).join(",");
  beginSession(items, "practice", `隨機練習・可直接作答 ${items.length} 題`);
}

function startMock() {
  updateYearMeta();
  const items = makeItems(activeExam, activeExam.questionCount, false);
  beginSession(items, "mock", `${activeExam.year} 學年度整回模考`);
}

function startWrongBook() {
  const refs = safeRead(WRONG_KEY, []);
  const items = refs.flatMap((ref) => {
    const exam = findExam(ref.year);
    return exam && exam.answers[ref.no - 1] ? [{ year: ref.year, no: ref.no, answer: exam.answers[ref.no - 1], questionUrl: exam.questionUrl }] : [];
  });
  if (!items.length) {
    showInfo("錯題本目前是空的", "完成一次交卷後，答錯題目會記在這裡；未作答題目不會被當成錯題。");
    return;
  }
  beginSession(items, "wrong", `錯題本・${items.length} 題`);
}

function collectAnswers() {
  const values = {};
  for (const input of $("answerForm").querySelectorAll("input:checked")) values[input.dataset.key] = input.value;
  return values;
}

function appendHistory(outcome) {
  const history = safeRead(HISTORY_KEY, []);
  history.unshift({
    id: `${Date.now()}-${sessionMode}`,
    at: new Date().toISOString(),
    mode: sessionMode,
    years: [...new Set(sessionItems.map((item) => item.year))],
    total: outcome.total,
    answered: outcome.total - outcome.unanswered.length,
    correct: outcome.correct,
    percent: outcome.percent,
    seconds: Math.max(0, Math.round((Date.now() - startedAt) / 1000)),
    wrong: outcome.wrong.map((item) => ({ year: item.year, no: item.no })),
  });
  safeWrite(HISTORY_KEY, history.slice(0, 100));
}

function statsChartHtml(item, group = "all") {
  const stats = item.year === 115 ? OFFICIAL_OPTION_STATS_115[item.no] : null;
  if (!stats) return "";
  const values = stats[group];
  const accepted = acceptedAnswers(item.answer);
  const wrongChoices = ["A", "B", "C", "D"].filter((choice) => !accepted.includes(choice));
  const lure = wrongChoices.sort((a, b) => values[b] - values[a])[0];
  return `<div class="option-stat-rows">${["A", "B", "C", "D"].map((choice) => {
    const correct = acceptedAnswers(item.answer).includes(choice);
    const lureText = choice === lure && values[choice] >= 10 ? " ← 最多人選錯" : "";
    return `<div class="option-stat-row"><span>(${choice})${correct ? " ✓正解" : lureText}</span><div><i style="width:${values[choice]}%" class="${correct ? "correct" : ""}"></i></div><b>${values[choice].toFixed(1)}%</b></div>`;
  }).join("")}</div>`;
}

function lureTeachingHtml(item) {
  const stats = item.year === 115 ? OFFICIAL_OPTION_STATS_115[item.no] : null;
  if (!stats?.low) return "";
  const accepted = acceptedAnswers(item.answer);
  const ranked = ["A", "B", "C", "D"].filter((choice) => !accepted.includes(choice)).map((choice) => ({ choice, gap: stats.low[choice] - stats.all[choice] })).sort((a, b) => b.gap - a.gap);
  const top = ranked[0];
  if (!top || top.gap < 5) return "";
  return `<div class="lure-note">⚠ 待加強組有 ${stats.low[top.choice].toFixed(1)}% 選（${top.choice}），比全體高 ${top.gap.toFixed(1)} 個百分點。這題最需要釐清的是（${top.choice}）為什麼不對。</div>`;
}

function liveStatusHtml(item, selected) {
  const correct = acceptedAnswers(item.answer).includes(selected) || item.answer === "送分";
  return `<p class="feedback-status ${correct ? "is-correct" : "is-wrong"}">${correct ? "✓ 答對了！" : "✕ 答錯了"} <span>正解：${escapeHtml(item.answer)}</span></p>`;
}

function renderQuestionFeedback(responses, revealUnanswered = false) {
  for (const item of sessionItems) {
    if (!item.question) continue;
    const key = itemKey(item);
    const card = $("answerGrid").querySelector(`[data-key="${key}"]`);
    if (!card) continue;
    const selected = responses[key];
    if (!selected && !revealUnanswered) continue;
    const accepted = acceptedAnswers(item.answer);
    card.querySelectorAll(".question-option").forEach((label) => {
      const input = label.querySelector("input");
      const value = input.value;
      label.classList.toggle("is-correct", accepted.includes(value));
      label.classList.toggle("is-wrong", value === selected && !accepted.includes(value));
      label.classList.toggle("is-locked", Boolean(selected));
      input.disabled = Boolean(selected);
    });
    const insight = item.question.explain ? { explain: item.question.explain } : (item.year === 115 ? QUESTION_INSIGHTS_115[item.no] : null);
    const metric = OFFICIAL_METRICS[item.year]?.items[item.no];
    const stats = item.year === 115 ? OFFICIAL_OPTION_STATS_115[item.no] : null;
    const savedReason = safeRead(WRONG_REASON_KEY, {})[key];
    const feedback = $(`feedback-${key}`);
    const state = $(`state-${key}`);
    if (state) state.textContent = selected ? (accepted.includes(selected) || item.answer === "送分" ? "已答對" : "待訂正") : "未作答";
    feedback.hidden = false;
    feedback.innerHTML = `
      ${selected ? liveStatusHtml(item, selected) : `<p class="feedback-status pending">尚未作答</p>`}
      <p><strong>你的答案：${selected ? escapeHtml(selected) : "—"}</strong>・正解：${escapeHtml(item.answer)}</p>
      <div class="explanation"><span class="explain-label">本站自編解析（非官方）</span><b>解題關鍵</b><p>${escapeHtml(insight?.explain ?? "本題解析已依題組材料與官方答案整理；遇到圖表選項時，請同步開啟官方題本核對圖像細節。")}</p></div>
      ${metric ? `<p class="metric-badges"><span>難度：${metric.difficulty}</span><span>鑑別度：${metric.discrimination}</span>${stats ? `<span>官方答對率 ${(stats.pass * 100).toFixed(0)}%</span><span>鑑別度 ${stats.discrimination.toFixed(2)}</span>` : ""}</p>` : ""}
      ${stats ? `<div class="official-stats"><div class="official-source-label">官方公布資料</div><div class="stats-head"><b class="stats-title">全體考生作答分布（統測中心試題研討會）</b><span><button type="button" data-stats-key="${key}" data-stats-group="all" class="active" aria-pressed="true">全體</button><button type="button" data-stats-key="${key}" data-stats-group="low" aria-pressed="false">待加強組</button></span></div><div class="stats-chart" data-chart-key="${key}">${statsChartHtml(item, "all")}</div><small>未作答與複選未列入，四項合計可能略低於 100%。</small>${lureTeachingHtml(item)}</div>` : `<p class="stats-unavailable">本題官方未公開選項百分比分布；本站不以答對率反推。</p>`}
      ${selected && !accepted.includes(selected) ? `<div class="wrong-reason"><span>這題錯在：</span>${["看錯題意", "詞義不熟", "證據抓錯", "概念不熟", "用猜的"].map((reason) => `<button type="button" data-reason="${reason}" aria-pressed="${savedReason === reason}" class="${savedReason === reason ? "active" : ""}">${reason}</button>`).join("")}<small class="wrong-reason-tip">選一個最接近的原因，之後重練會更有方向。</small></div><button type="button" class="retry-question" data-retry-key="${key}">再練一次這題</button>` : ""}
    `;
  }
}

function handleAnswerChange(event) {
  if (!event.target.matches("input[type=radio][data-key]")) return;
  const responses = collectAnswers();
  saveResponses(responses);
  updateAnsweredCount();
  const item = sessionItems.find((candidate) => itemKey(candidate) === event.target.dataset.key);
  if (item?.question) renderQuestionFeedback(responses);
}

function grade() {
  if (!sessionItems.length || sessionSubmitted) return;
  sessionSubmitted = true;
  clearInterval(timerId);
  const responses = collectAnswers();
  saveResponses(responses);
  const outcome = gradeItems(sessionItems, responses);
  const correctItems = sessionItems.filter((item) => (item.answer === "送分" || responses[itemKey(item)]) && !outcome.wrong.some((wrong) => itemKey(wrong) === itemKey(item)));
  const wrongBook = mergeWrongBook(safeRead(WRONG_KEY, []), outcome.wrong, correctItems);
  safeWrite(WRONG_KEY, wrongBook);
  updateWrongCount();
  appendHistory(outcome);
  renderQuestionFeedback(responses, true);
  $("answerForm").querySelectorAll("input").forEach((input) => { input.disabled = true; });
  $("answerForm").querySelectorAll(".question-option, .choice").forEach((option) => option.classList.add("is-locked"));
  $("answerForm").querySelector(".submit").disabled = true;
  $("clearButton").disabled = true;

  const wrongText = outcome.wrong.length ? `答錯：${outcome.wrong.map((item) => `${item.year}-${item.no}（選 ${item.selected}）`).join("、")}` : "沒有答錯題。";
  const unansweredText = outcome.unanswered.length ? `未作答：${outcome.unanswered.map(itemKey).join("、")}` : "無未計分題目。";
  $("result").innerHTML = `<strong>${outcome.correct} / ${outcome.total} 題（${outcome.percent}%）</strong><p>${wrongText}</p><p>${unansweredText}</p><div class="result-actions"><button id="restartSession" class="primary" type="button">重新作答本卷</button><a href="check?year=${sessionItems[0].year}" class="button-link secondary">前往逐題校對</a></div>`;
  $("result").hidden = false;
  $("result").scrollIntoView({ behavior: "smooth", block: "nearest" });
  focusPanel($("result"));
  announce(`本卷完成，答對 ${outcome.correct} 題，共 ${outcome.total} 題。`);
}

function restartSession() {
  const items = sessionItems.map(({ year, no, answer, questionUrl }) => ({ year, no, answer, questionUrl }));
  beginSession(items, sessionMode, $("paperTitle").textContent);
}

function retryQuestion(key) {
  const item = sessionItems.find((candidate) => itemKey(candidate) === key);
  const card = $("answerGrid").querySelector(`article[data-key="${key}"]`);
  if (!item || !card || sessionSubmitted) return;
  const saved = safeRead(storageKey(item.year), {});
  delete saved[item.no];
  safeWrite(storageKey(item.year), saved);
  card.querySelectorAll("input").forEach((input) => { input.checked = false; input.disabled = false; });
  card.querySelectorAll(".question-option").forEach((option) => option.classList.remove("is-correct", "is-wrong", "is-locked"));
  card.querySelector(".question-feedback").hidden = true;
  const state = $(`state-${key}`);
  if (state) state.textContent = "重新作答";
  updateAnsweredCount();
  card.querySelector("input")?.focus();
  announce(`第 ${item.no} 題已可重新作答。`);
}

function updateWrongCount() {
  $("wrongCount").textContent = safeRead(WRONG_KEY, []).length;
}

function showInfo(title, message) {
  $("historyPanel").hidden = false;
  $("historyContent").innerHTML = `<div class="empty-state"><strong>${title}</strong><p>${message}</p></div>`;
  $("historyPanel").scrollIntoView({ behavior: "smooth", block: "start" });
  focusPanel($("historyPanel"));
}

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function showHistory() {
  const history = safeRead(HISTORY_KEY, []);
  $("historyPanel").hidden = false;
  $("historyContent").innerHTML = history.length ? history.map((entry) => {
    const label = { practice: "題號練習", daily: "今日複習", mock: "整回模考", wrong: "錯題複習" }[entry.mode] ?? "練習";
    const wrongList = entry.wrong?.length ? entry.wrong.map((item) => `${item.year}-${item.no}`).join("、") : "無";
    return `<article class="history-entry"><div><strong>${label}・${entry.years.join("、")} 學年度</strong><p>${new Date(entry.at).toLocaleString("zh-TW")}・作答 ${entry.answered}/${entry.total} 題・用時 ${formatDuration(entry.seconds)}</p><small>錯題：${wrongList}</small>${entry.wrong?.length ? `<button type="button" class="text-button history-retry" data-history-id="${entry.id}">重練這次錯題</button>` : ""}</div><b>${entry.correct}/${entry.total}<small>${entry.percent}%</small></b></article>`;
  }).join("") : `<div class="empty-state"><strong>還沒有練習紀錄</strong><p>交卷後會在這裡保留最近 100 次紀錄，只存在這台裝置。</p></div>`;
  $("historyPanel").scrollIntoView({ behavior: "smooth", block: "start" });
  focusPanel($("historyPanel"));
}

function showRank() {
  updateYearMeta();
  const metrics = OFFICIAL_METRICS[activeExam.year];
  $("rankPanel").hidden = false;
  if (!metrics) {
    $("rankContent").innerHTML = `<div class="empty-state"><strong>${activeExam.year} 年沒有完整官方逐題統計</strong><p>本站不以答案或其他年份反推難度與鑑別度。</p></div>`;
  } else {
    const rows = Object.values(metrics.items).sort((a, b) => difficultyRank(a.difficulty) - difficultyRank(b.difficulty) || a.no - b.no);
    $("rankContent").innerHTML = `<div class="rank-table"><div class="rank-row rank-head"><b>題號</b><b>難度</b><b>鑑別度</b><b></b></div>${rows.map((item) => `<div class="rank-row"><span>${item.no}</span><span>${item.difficulty}</span><span>${item.discrimination}</span><button type="button" class="text-button rank-practice" data-no="${item.no}">練這題</button></div>`).join("")}</div>`;
  }
  $("rankPanel").scrollIntoView({ behavior: "smooth", block: "start" });
  focusPanel($("rankPanel"));
}

function currentTeacherItems() {
  updateYearMeta();
  return makeItemsFromNumbers(activeExam, filteredNumbersForExam(activeExam), $("questionCount").value, $("randomToggle").checked);
}

function renderTeacherPreview(items = currentTeacherItems()) {
  teacherItems = items.map((item) => ({ ...item, question: findQuestion(item.year, item.no) }));
  teacherSelection = new Set(teacherItems.map(itemKey));
  $("teacherPreview").dataset.paper = $("paperSize").value;
  $("teacherPreview").innerHTML = `<h3>${activeExam.year} 學年度統測英文・選題清單</h3><p>目前套用上方篩選，共 ${teacherItems.length} 題。取消勾選即可排除。</p><div class="teacher-question-list">${teacherItems.map((item) => `<label><input class="teacher-pick" type="checkbox" value="${itemKey(item)}" checked><span><b>第 ${item.no} 題</b>${item.question ? `・${escapeHtml(CATEGORIES[item.question.cat] ?? item.question.cat)}／${escapeHtml(item.question.tags?.[0] ?? "")}` : "・請搭配官方原卷"}<small>${item.question ? escapeHtml(item.question.stem) : "官方原卷題號"}</small></span></label>`).join("")}</div>`;
  updateTeacherSelectionCount();
  return teacherItems;
}

function updateTeacherSelectionCount() {
  $("selectedTeacherCount").textContent = `已選 ${teacherSelection.size} 題`;
}

function selectedTeacherItems() {
  return teacherItems.filter((item) => teacherSelection.has(itemKey(item)));
}

function teacherPaperHtml(items) {
  const title = `${activeExam.year} 學年度統測英文練習卷`;
  const renderedGroups = new Set();
  const questions = items.map((item, index) => {
    if (!item.question) return `<article class="print-question"><h3>${index + 1}. 官方原卷第 ${item.no} 題</h3><p>請搭配官方原卷作答：○A　○B　○C　○D</p></article>`;
    const q = item.question;
    const bank = findQuestionBank(item.year);
    const group = q.group ? bank?.groups[q.group] : null;
    const groupKey = `${item.year}-${q.group}`;
    const groupPassage = (group?.passage || group?.image) && !renderedGroups.has(groupKey) ? (renderedGroups.add(groupKey), `<div class="print-passage"><b>${escapeHtml(group.title)}</b>${group.passage ?? ""}${group.image ? `<img class="source-figure" src="${escapeHtml(group.image)}" alt="官方圖表">` : ""}</div>`) : "";
    const figureNote = requiresOfficialFigure(q, item.year) ? `<p class="print-figure-note">※ 本題含圖，列印後請搭配官方原卷。</p>` : "";
    return `<article class="print-question">${groupPassage}${q.passage ? `<div class="print-passage">${q.passage}</div>` : ""}<h3>${index + 1}. ${escapeHtml(q.stem)}</h3>${figureNote}<ol type="A">${["A", "B", "C", "D"].map((choice) => `<li>${escapeHtml(q.options[choice])}</li>`).join("")}</ol></article>`;
  }).join("");
  const answers = items.map((item, index) => `<li><b>第 ${index + 1} 題：${escapeHtml(item.answer)}</b>${item.question ? `<p>${escapeHtml(item.question.explain ?? QUESTION_INSIGHTS_115[item.no]?.explain ?? "請參照官方答案。")}</p>` : ""}</li>`).join("");
  return `<header><h1>${title}</h1><p>共 ${items.length} 題・題目來源：技專校院入學測驗中心</p></header><section class="print-questions">${questions}</section><section class="teacher-answer-section"><h2>教師答案與解析</h2><ol>${answers}</ol></section>`;
}

function prepareTeacherPrint() {
  const items = selectedTeacherItems();
  if (!items.length) { showInfo("尚未選題", "請先在出卷模式勾選至少一題。"); return false; }
  $("teacherPrint").innerHTML = teacherPaperHtml(items);
  $("teacherPrint").dataset.paper = $("paperSize").value;
  $("paperPageStyle").textContent = $("paperSize").value === "B4" ? "@media print{@page{size:257mm 364mm;margin:12mm}}" : "@media print{@page{size:A4;margin:12mm}}";
  $("teacherPrint").hidden = false;
  return true;
}

function showTeacherPanel() {
  $("teacherPanel").hidden = false;
  renderTeacherPreview();
  $("teacherPanel").scrollIntoView({ behavior: "smooth", block: "start" });
  focusPanel($("teacherTitle"));
}

async function sharePractice() {
  const items = selectedTeacherItems();
  if (!items.length) { showInfo("尚未選題", "請先在出卷模式勾選至少一題。"); return; }
  const url = new URL(location.href);
  url.hash = "";
  url.search = new URLSearchParams({ year: activeExam.year, questions: items.map((item) => item.no).join(","), timed: $("timedToggle").checked ? "1" : "0" });
  try {
    await navigator.clipboard.writeText(url.toString());
    showInfo("練習連結已複製", "連結會開啟你勾選的題目；115 年可直接線上逐題作答。");
  } catch {
    showInfo("練習連結", `<a href="${url}">${url}</a>`);
  }
}

function downloadTeacherWord() {
  const items = selectedTeacherItems();
  if (!items.length) { showInfo("尚未選題", "請先在出卷模式勾選至少一題。"); return; }
  const documentHtml = `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:serif;line-height:1.7}article{page-break-inside:avoid;margin:0 0 20px}li{margin:6px 0}.teacher-answer-section{page-break-before:always}.print-passage{background:#f3ead5;padding:12px}</style></head><body>${teacherPaperHtml(items)}</body></html>`;
  const blob = new Blob([documentHtml], { type: "application/msword;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${activeExam.year}-統測英文練習卷.doc`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function exportRecords() {
  const records = Object.fromEntries(exams.map((exam) => [exam.year, safeRead(storageKey(exam.year), {})]));
  const payload = { version: 1, exportedAt: new Date().toISOString(), records, wrongBook: safeRead(WRONG_KEY, []), wrongReasons: safeRead(WRONG_REASON_KEY, {}), history: safeRead(HISTORY_KEY, []) };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "tvet-english-progress.json";
  link.click();
  URL.revokeObjectURL(link.href);
}

async function importRecords(file) {
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    if (payload.version !== 1 || typeof payload.records !== "object") throw new Error("invalid");
    for (const exam of exams) {
      const incoming = payload.records[exam.year];
      if (incoming && typeof incoming === "object") safeWrite(storageKey(exam.year), { ...safeRead(storageKey(exam.year), {}), ...incoming });
    }
    safeWrite(WRONG_KEY, mergeWrongBook(safeRead(WRONG_KEY, []), Array.isArray(payload.wrongBook) ? payload.wrongBook : []));
    if (payload.wrongReasons && typeof payload.wrongReasons === "object") safeWrite(WRONG_REASON_KEY, { ...safeRead(WRONG_REASON_KEY, {}), ...payload.wrongReasons });
    const history = [...(Array.isArray(payload.history) ? payload.history : []), ...safeRead(HISTORY_KEY, [])];
    safeWrite(HISTORY_KEY, [...new Map(history.map((entry) => [entry.id, entry])).values()].slice(0, 100));
    updateWrongCount();
    showInfo("匯入完成", "已採合併方式保留原紀錄，不會清除這台裝置上的學習資料。");
  } catch {
    showInfo("無法匯入", "檔案不是本站可辨識的學習紀錄 JSON。");
  } finally {
    $("importInput").value = "";
  }
}

function renderArchive() {
  $("archiveGrid").innerHTML = exams.map((exam) => `<article><span>${exam.year}</span><div><strong>${exam.year} 學年度</strong><p>${exam.questionCount} 題・${exam.era}</p></div><a href="${exam.sourcePage}" target="_blank" rel="noopener">官方頁面</a></article>`).join("");
}

function loadSharedSession() {
  const params = new URLSearchParams(location.search);
  const exam = findExam(params.get("year"));
  const numbers = (params.get("questions") ?? "").split(",").map(Number).filter((no) => exam && Number.isInteger(no) && no >= 1 && no <= exam.questionCount);
  if (!exam || !numbers.length) return;
  setSelectedYears([exam.year]);
  $("timedToggle").checked = params.get("timed") === "1";
  updateYearMeta();
  const unique = [...new Set(numbers)];
  beginSession(unique.map((no) => ({ year: exam.year, no, answer: exam.answers[no - 1], questionUrl: exam.questionUrl })), "practice", `${exam.year} 學年度・分享練習 ${unique.length} 題`);
}

$("yearOptions").addEventListener("change", (event) => {
  if (!event.target.matches('input[type="checkbox"]')) return;
  const year = Number(event.target.value);
  if (event.target.checked) selectedYears.add(year); else selectedYears.delete(year);
  updateYearMeta();
});
$("selectAllYears").addEventListener("click", () => setSelectedYears(exams.map((exam) => exam.year)));
$("clearAllYears").addEventListener("click", () => setSelectedYears([]));
$("questionCount").addEventListener("input", updateYearMeta);
$("randomToggle").addEventListener("change", updateYearMeta);
$("difficultySelect").addEventListener("change", updateYearMeta);
$("discriminationSelect").addEventListener("change", updateYearMeta);
$("easyFirstToggle").addEventListener("change", updateYearMeta);
$("startButton").addEventListener("click", startPractice);
$("quickStartButton").addEventListener("click", startQuickPractice);
$("mockButton").addEventListener("click", startMock);
$("wrongBookButton").addEventListener("click", startWrongBook);
$("historyButton").addEventListener("click", showHistory);
$("rankButton").addEventListener("click", showRank);
$("closeHistory").addEventListener("click", () => { $("historyPanel").hidden = true; restoreMoreActionFocus("historyButton"); });
$("closeRank").addEventListener("click", () => { $("rankPanel").hidden = true; restoreMoreActionFocus("rankButton"); });
$("historyContent").addEventListener("click", (event) => {
  const button = event.target.closest(".history-retry");
  if (!button) return;
  const entry = safeRead(HISTORY_KEY, []).find((candidate) => candidate.id === button.dataset.historyId);
  const items = (entry?.wrong ?? []).flatMap((ref) => {
    const exam = findExam(ref.year);
    return exam ? [{ year: ref.year, no: ref.no, answer: exam.answers[ref.no - 1], questionUrl: exam.questionUrl }] : [];
  });
  if (items.length) beginSession(items, "wrong", `歷程錯題重練・${items.length} 題`);
});
$("rankContent").addEventListener("click", (event) => {
  const button = event.target.closest(".rank-practice");
  if (!button) return;
  const no = Number(button.dataset.no);
  const exam = activeExam;
  beginSession([{ year: exam.year, no, answer: exam.answers[no - 1], questionUrl: exam.questionUrl }], "practice", `${exam.year} 學年度・第 ${no} 題`);
});
$("teacherButton").addEventListener("click", showTeacherPanel);
$("closeTeacher").addEventListener("click", () => { $("teacherPanel").hidden = true; restoreMoreActionFocus("teacherButton"); });
$("applyTeacherButton").addEventListener("click", () => renderTeacherPreview());
$("paperSize").addEventListener("change", () => { $("teacherPreview").dataset.paper = $("paperSize").value; });
$("shareButton").addEventListener("click", sharePractice);
$("teacherPreview").addEventListener("change", (event) => {
  if (!event.target.matches(".teacher-pick")) return;
  if (event.target.checked) teacherSelection.add(event.target.value);
  else teacherSelection.delete(event.target.value);
  updateTeacherSelectionCount();
});
$("selectAllTeacher").addEventListener("click", () => {
  teacherSelection = new Set(teacherItems.map(itemKey));
  $("teacherPreview").querySelectorAll(".teacher-pick").forEach((input) => { input.checked = true; });
  updateTeacherSelectionCount();
});
$("selectNoneTeacher").addEventListener("click", () => {
  teacherSelection.clear();
  $("teacherPreview").querySelectorAll(".teacher-pick").forEach((input) => { input.checked = false; });
  updateTeacherSelectionCount();
});
$("printButton").addEventListener("click", () => { if (prepareTeacherPrint()) requestAnimationFrame(() => window.print()); });
$("wordButton").addEventListener("click", downloadTeacherWord);
window.addEventListener("afterprint", () => { $("teacherPrint").hidden = true; });
$("answerForm").addEventListener("change", handleAnswerChange);
$("answerGrid").addEventListener("click", (event) => {
  const reportButton = event.target.closest("[data-report-key]");
  if (reportButton) {
    const item = sessionItems.find((candidate) => itemKey(candidate) === reportButton.dataset.reportKey);
    if (item) window.TvetReport.openQuestion(questionReportContext(item));
    return;
  }
  const reasonButton = event.target.closest("[data-reason]");
  if (reasonButton) {
    const card = reasonButton.closest(".question-card");
    const reasons = safeRead(WRONG_REASON_KEY, {});
    reasons[card.dataset.key] = reasonButton.dataset.reason;
    safeWrite(WRONG_REASON_KEY, reasons);
    reasonButton.closest(".wrong-reason").querySelectorAll("button").forEach((candidate) => {
      const active = candidate === reasonButton;
      candidate.classList.toggle("active", active);
      candidate.setAttribute("aria-pressed", String(active));
    });
    const tips = { "看錯題意": "下次先圈出題目要你找的關鍵詞。", "詞義不熟": "把不熟的詞放回上下文，再比較前後語意。", "證據抓錯": "回到文章找能直接支持答案的句子。", "概念不熟": "先補清楚這一類題目的基本概念。", "用猜的": "先刪除明顯不合文意的選項，再做判斷。" };
    reasonButton.closest(".wrong-reason").querySelector(".wrong-reason-tip").textContent = tips[reasonButton.dataset.reason];
    return;
  }
  const retryButton = event.target.closest("[data-retry-key]");
  if (retryButton) { retryQuestion(retryButton.dataset.retryKey); return; }
  const button = event.target.closest("[data-stats-key]");
  if (!button) return;
  const item = sessionItems.find((candidate) => itemKey(candidate) === button.dataset.statsKey);
  if (!item) return;
  const box = button.closest(".official-stats");
  box.querySelectorAll("[data-stats-key]").forEach((candidate) => {
    const active = candidate === button;
    candidate.classList.toggle("active", active);
    candidate.setAttribute("aria-pressed", String(active));
  });
  box.querySelector(".stats-chart").innerHTML = statsChartHtml(item, button.dataset.statsGroup);
  box.querySelector(".stats-title").textContent = `${button.dataset.statsGroup === "low" ? "待加強組" : "全體考生"}作答分布（統測中心官方研討會）`;
});
$("answerForm").addEventListener("submit", (event) => { event.preventDefault(); grade(); });
$("result").addEventListener("click", (event) => { if (event.target.closest("#restartSession")) restartSession(); });
$("clearButton").addEventListener("click", () => { for (const item of sessionItems) { const saved = safeRead(storageKey(item.year), {}); delete saved[item.no]; safeWrite(storageKey(item.year), saved); } renderAnswerGrid(); $("result").hidden = true; });
$("exportButton").addEventListener("click", exportRecords);
$("importInput").addEventListener("change", () => importRecords($("importInput").files[0]));
$("advancedToggle").addEventListener("click", () => { const hidden = !$("builderBody").hidden; $("builderBody").hidden = hidden; $("filterSummary").hidden = !hidden; $("advancedToggle").setAttribute("aria-expanded", String(!hidden)); $("advancedToggle").textContent = hidden ? "挑選大標／小標⌄" : "收合大標／小標⌃"; });
$("moreToggle").addEventListener("click", () => { const hidden = !$("moreActions").hidden; $("moreActions").hidden = hidden; $("moreToggle").setAttribute("aria-expanded", String(!hidden)); $("moreToggle").textContent = hidden ? "更多功能⌄" : "收起功能⌃"; });

renderCategoryOptions();
renderYearOptions();
renderArchive();
updateWrongCount();
loadSharedSession();
