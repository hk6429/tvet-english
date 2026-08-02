import { classifyQuestion, explanationFor } from "./question-metadata.mjs";
import { GROUP_PASSAGES_93, QUESTION_CORRECTIONS_93 } from "./manual-corrections-93.mjs";
import { GROUP_CORRECTIONS_OCR, QUESTION_CORRECTIONS_OCR, TEXT_REPLACEMENTS } from "./manual-corrections-ocr.mjs";

function cleanLine(line) {
  return line.replace(/\s+$/g, "");
}

function isPageFurniture(line) {
  const compact = line.replace(/\s+/g, "");
  if (!compact) return false;
  return compact === "公告試題" || compact === "僅供參考" || compact === "公告試題僅供參考"
    || /^共同科目英文$/.test(compact) || /^英文共同科目$/.test(compact)
    || /^第\d+頁$/.test(compact) || /^共\d+頁$/.test(compact)
    || /^[-–—]?\d+[-–—]?$/.test(compact)
    || /背面尚有試題|以下空白/.test(compact)
    || (/年四技/.test(compact) && /英文/.test(compact))
    || /^[A-Z&#@\d\s]{2,12}$/.test(line.trim());
}

function marker(line, expected) {
  const match = line.match(/^\s*(\d{1,2})\s*(?:\.a(?=\s*(?:[A-Z]|\(A\)))|[.、．])\s*(.*)$/)
    ?? line.match(/^\s*(\d{1,2})\s+(?=\(A\))\s*(.*)$/i);
  if (!match) return null;
  const no = Number(match[1]);
  return no >= 1 && no <= expected ? { no, rest: match[2] ?? "" } : null;
}

function detectSection(line) {
  const compact = line.replace(/\s+/g, "");
  if (/字彙(?:及慣用語)?(?:題)?/.test(compact)) return "vocabulary";
  if (/對話題/.test(compact)) return "dialogue";
  if (/綜合測驗/.test(compact)) return "cloze";
  if (/閱讀測驗/.test(compact)) return "reading";
  return null;
}

function historicalSection(year, no, detected) {
  if (year === 93 || !detected) {
    if (no <= 15) return "vocabulary";
    if (no <= 25) return "dialogue";
    if (no <= 40) return "cloze";
    return "reading";
  }
  return detected;
}

function cleanText(value) {
  return value
    .replace(/^\s*(?:公告|試題|公告試題|公告試題僅供參考)\s*$/gm, "")
    .replace(/\s+-\s*\d+\s*-\s*◢[\s\S]*$/g, "")
    .replace(/\s+(?:共\s*\d+\s*頁\s+第\s*\d+\s*頁|第\s*\d+\s*頁\s+共\s*\d+\s*頁)[\s\S]*$/g, "")
    .replace(/\s+共\s*\d+\s*頁\s+公告試題僅供參考\s+\d+\s*年四技[\s\S]*$/g, "")
    .replace(/\s+\d+\s*年四技\s+英文\s+共同科目\s+公告試題僅供參考\s+第\s*\d+\s*頁[\s\S]*$/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.;:?!])/g, "$1")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .trim();
}

function cleanStem(value) {
  const withBlanks = value.split("\n").map((line) => {
    let normalized = line;
    const speakerGap = normalized.match(/^(\s*[^:\n]{1,28}:)([ \t]+)(\S[\s\S]*)$/);
    if (speakerGap) {
      normalized = `${speakerGap[1]}${speakerGap[2].length >= 10 ? " ____________ " : " "}${speakerGap[3]}`;
      normalized = normalized.replace(/(_{3,})[ \t]{2,}/g, "$1 ");
    } else {
      normalized = normalized.replace(/(?<=\S)[ \t]{3,}(?=\S)/g, " ____________ ");
    }
    if (/[:：]\s*$/.test(normalized) && !/^(?:https?|ftp):/i.test(normalized.trim())) normalized = `${normalized.trimEnd()} ____________`;
    return normalized;
  }).join("\n");
  return cleanText(withBlanks).replace(/(?:_{3,}\s*){2,}/g, "____________ ").trim();
}

function splitOptionTail(value, no) {
  for (const boundary of value.matchAll(/\n/g)) {
    const head = value.slice(0, boundary.index);
    const tail = value.slice(boundary.index + 1).trim();
    if (!tail) continue;
    const compact = tail.replace(/\s+/g, "");
    const hasHeading = /(?:字彙|對話|綜合|閱讀)測?驗|▲|下篇短文|閱讀下文/.test(compact);
    const hasNextBlank = new RegExp(`(?:^|\\s)${no + 1}(?:\\s|[.,;:])`).test(tail);
    const hasPassage = (tail.match(/[A-Za-z]/g) ?? []).length >= 70;
    if (hasHeading || (hasNextBlank && hasPassage)) return { option: head.trim(), tail };
  }
  const boundaries = [...value.matchAll(/\n\s*\n/g)];
  for (const boundary of boundaries) {
    const head = value.slice(0, boundary.index);
    const tail = value.slice(boundary.index + boundary[0].length).trim();
    if (!tail) continue;
    const compact = tail.replace(/\s+/g, "");
    const hasHeading = /(?:字彙|對話|綜合|閱讀)測?驗|▲|下篇短文|閱讀下文/.test(compact);
    const hasPassage = (tail.match(/[A-Za-z]/g) ?? []).length >= 70;
    if (hasHeading || hasPassage) return { option: head.trim(), tail };
  }
  return { option: value.trim(), tail: "" };
}

function parseQuestionBlock(block, no) {
  const optionRegex = /\(([A-D])\)\s*/g;
  const matches = [...block.matchAll(optionRegex)];
  const sequence = [];
  let expectedChoice = "A";
  for (const match of matches) {
    if (match[1] !== expectedChoice) continue;
    sequence.push(match);
    expectedChoice = String.fromCharCode(expectedChoice.charCodeAt(0) + 1);
    if (sequence.length === 4) break;
  }
  if (sequence.length !== 4) throw new Error(`第 ${no} 題找不到完整 A–D 選項`);

  const stem = cleanStem(block.slice(0, sequence[0].index).replace(/^\s*\d{1,2}\s*(?:\.a(?=\s*(?:$|[A-Z]|\(A\)))|[.、．,，])?\s*/, ""));
  const options = {};
  for (let index = 0; index < 3; index += 1) {
    options[sequence[index][1]] = cleanText(block.slice(sequence[index].index + sequence[index][0].length, sequence[index + 1].index));
  }
  const dValue = block.slice(sequence[3].index + sequence[3][0].length);
  const { option, tail } = splitOptionTail(dValue, no);
  options.D = cleanText(option);
  return { stem, options, tail: cleanText(tail) };
}

function passageHtml(text) {
  const escape = (value) => value.replace(/[&<>]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[character]);
  return text.split(/\n\s*\n/).map((paragraph) => `<p>${escape(cleanText(paragraph)).replaceAll("\n", "<br>")}</p>`).join("");
}

function stripDirections(text) {
  const lines = text.split("\n");
  while (lines.length && (!lines[0].trim() || detectSection(lines[0]) || /第\s*\d+\s*[至－–—-]\s*\d+\s*題|請.*選出|每題|下面.*短文|以下.*短文/.test(lines[0]))) lines.shift();
  return cleanText(lines.join("\n"));
}

function explicitRange(text) {
  const compact = text.replace(/\s+/g, "");
  if (!/▲|下篇短文|閱讀下文|回答第/.test(compact)) return null;
  const matches = [...compact.matchAll(/(?:回答第?|為第)(\d+)[至－–—-](\d+)題/g)];
  const match = matches.at(-1);
  return match ? { start: Number(match[1]), end: Number(match[2]) } : null;
}

export function parsePdfBank({ year, text, expected, answers }) {
  if (year === 93) text = text.replace(/\(A[jV](?=[A-Za-z])/g, "(A) ").replace(/^44,\s+/m, "44. ");
  const pages = text.split("\f");
  const lines = [];
  let detectedSection = year <= 103 ? "vocabulary" : null;
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    for (const rawLine of pages[pageIndex].split("\n")) {
      const line = cleanLine(rawLine);
      if (isPageFurniture(line)) continue;
      const section = detectSection(line);
      if (section) detectedSection = section;
      lines.push({ text: line, page: pageIndex + 1, detectedSection });
    }
    lines.push({ text: "", page: pageIndex + 1, detectedSection });
  }

  const firstSection = lines.findIndex((item) => detectSection(item.text));
  const markers = [];
  let cursor = Math.max(0, firstSection);
  for (let no = 1; no <= expected; no += 1) {
    let found = -1;
    for (let index = cursor; index < lines.length; index += 1) {
      if (marker(lines[index].text, expected)?.no === no) { found = index; break; }
    }
    if (found < 0) throw new Error(`${year} 年找不到第 ${no} 題題號`);
    markers.push({ no, line: found, page: lines[found].page, detectedSection: lines[found].detectedSection });
    cursor = found + 1;
  }

  const parsed = [];
  for (let index = 0; index < markers.length; index += 1) {
    const current = markers[index];
    const end = markers[index + 1]?.line ?? lines.length;
    const block = lines.slice(current.line, end).map((item) => item.text).join("\n");
    const item = parseQuestionBlock(block, current.no);
    parsed.push({ ...item, no: current.no, page: current.page, section: historicalSection(year, current.no, current.detectedSection) });
  }

  const groupStarts = [];
  for (let index = 1; index < parsed.length; index += 1) {
    const item = parsed[index];
    if (!["cloze", "reading"].includes(item.section)) continue;
    const material = parsed[index - 1].tail;
    if (!material) continue;
    const stripped = stripDirections(material);
    const letters = (stripped.match(/[A-Za-z]/g) ?? []).length;
    if (letters < 60) continue;
    const range = explicitRange(material);
    groupStarts.push({ start: item.no, end: range?.end, material: stripped, page: item.page });
  }

  const firstClozeOrReading = parsed.find((item) => ["cloze", "reading"].includes(item.section));
  if (firstClozeOrReading) {
    const firstMarker = markers[firstClozeOrReading.no - 1];
    const previousMarker = markers[firstClozeOrReading.no - 2];
    if (previousMarker) {
      const material = parsed[firstClozeOrReading.no - 2].tail;
      if (material && !groupStarts.some((group) => group.start === firstClozeOrReading.no)) {
        const stripped = stripDirections(material);
        if ((stripped.match(/[A-Za-z]/g) ?? []).length >= 60) groupStarts.unshift({ start: firstClozeOrReading.no, material: stripped, page: firstMarker.page });
      }
    }
  }

  groupStarts.sort((a, b) => a.start - b.start);
  for (let index = 0; index < groupStarts.length; index += 1) {
    const current = groupStarts[index];
    const next = groupStarts.slice(index + 1).find((candidate) => candidate.start > current.start);
    if (next && (!current.end || current.end >= next.start)) current.end = next.start - 1;
    if (!current.end) {
      const sectionLast = [...parsed].reverse().find((item) => item.section === parsed[current.start - 1].section)?.no ?? expected;
      current.end = sectionLast;
    }
  }

  const groups = {};
  for (const group of groupStarts) {
    const id = `G${group.start}_${group.end}`;
    groups[id] = { title: `▲閱讀材料，回答第 ${group.start}–${group.end} 題`, passage: passageHtml(group.material), page: group.page };
  }

  const questions = parsed.map((item) => {
    const group = groupStarts.find((candidate) => item.no >= candidate.start && item.no <= candidate.end);
    const classification = classifyQuestion(item.section, item.stem);
    const question = {
      no: item.no,
      ...classification,
      stem: item.stem || (item.section === "cloze" ? `請依文章文意，選出第 ${item.no} 空最適合的答案。` : `請依題目內容選出第 ${item.no} 題最適當的答案。`),
      options: item.options,
      ...(group ? { group: `G${group.start}_${group.end}` } : {}),
      answer: answers[item.no - 1],
      sourcePage: item.page,
    };
    for (const choice of ["A", "B", "C", "D"]) {
      if (!question.options[choice]) {
        question.options[choice] = "〔圖像選項，請查看下方官方原卷圖〕";
        question.requiresSourcePage = true;
      }
    }
    question.explain = explanationFor(question, item.section);
    return question;
  });

  if (year === 93) {
    for (const [id, passage] of Object.entries(GROUP_PASSAGES_93)) {
      if (!groups[id]) throw new Error(`93 年人工校正找不到題組 ${id}`);
      groups[id].passage = passage;
    }
    for (const [number, correction] of Object.entries(QUESTION_CORRECTIONS_93)) {
      const question = questions[Number(number) - 1];
      if (!question || question.no !== Number(number)) throw new Error(`93 年人工校正找不到第 ${number} 題`);
      if (correction.stem) question.stem = correction.stem;
      if (correction.options) question.options = { ...question.options, ...correction.options };
      question.explain = explanationFor(question, parsed[Number(number) - 1].section);
    }
  }

  for (const [id, passage] of Object.entries(GROUP_CORRECTIONS_OCR[year] ?? {})) {
    if (!groups[id]) throw new Error(`${year} 年人工校正找不到題組 ${id}`);
    groups[id].passage = passage;
  }
  for (const [number, correction] of Object.entries(QUESTION_CORRECTIONS_OCR[year] ?? {})) {
    const question = questions[Number(number) - 1];
    if (!question || question.no !== Number(number)) throw new Error(`${year} 年人工校正找不到第 ${number} 題`);
    if (correction.stem) question.stem = correction.stem;
    if (correction.options) question.options = { ...question.options, ...correction.options };
    question.explain = explanationFor(question, parsed[Number(number) - 1].section);
  }
  for (const [before, after] of TEXT_REPLACEMENTS[year] ?? []) {
    for (const question of questions) {
      question.stem = question.stem.replaceAll(before, after);
      for (const choice of ["A", "B", "C", "D"]) question.options[choice] = question.options[choice].replaceAll(before, after);
    }
    for (const group of Object.values(groups)) group.passage = group.passage.replaceAll(before, after);
  }

  return { year, groups, questions };
}
