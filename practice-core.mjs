export function acceptedAnswers(answer) {
  return answer === "送分" ? ["A", "B", "C", "D"] : answer.split(/[、或/]/);
}

export function clampQuestionCount(value, maximum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return Math.min(10, maximum);
  return Math.max(1, Math.min(parsed, maximum));
}

export function makeItems(exam, count, random = true, randomFn = Math.random) {
  const numbers = Array.from({ length: exam.questionCount }, (_, index) => index + 1);
  return makeItemsFromNumbers(exam, numbers, count, random, randomFn);
}

export function makeItemsFromNumbers(exam, candidateNumbers, count, random = true, randomFn = Math.random) {
  const numbers = [...candidateNumbers];
  if (random) {
    for (let index = numbers.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(randomFn() * (index + 1));
      [numbers[index], numbers[swapIndex]] = [numbers[swapIndex], numbers[index]];
    }
  }
  return numbers.slice(0, clampQuestionCount(count, numbers.length)).map((no) => ({
    year: exam.year,
    no,
    answer: exam.answers[no - 1],
    questionUrl: exam.questionUrl,
  }));
}

export function makeItemsFromCandidates(candidates, count, random = true, randomFn = Math.random) {
  const pool = [...candidates];
  if (random) {
    for (let index = pool.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(randomFn() * (index + 1));
      [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
    }
  }
  return pool.slice(0, clampQuestionCount(count, pool.length)).map(({ exam, no }) => ({
    year: exam.year,
    no,
    answer: exam.answers[no - 1],
    questionUrl: exam.questionUrl,
  }));
}

export function gradeItems(items, responses) {
  let correct = 0;
  const wrong = [];
  const unanswered = [];
  for (const item of items) {
    const key = `${item.year}-${item.no}`;
    const selected = responses[key];
    if (item.answer === "送分") correct += 1;
    else if (!selected) unanswered.push(item);
    else if (acceptedAnswers(item.answer).includes(selected)) correct += 1;
    else wrong.push({ ...item, selected });
  }
  return { correct, wrong, unanswered, total: items.length, percent: Math.round(correct / items.length * 100) };
}

export function mergeWrongBook(current, wrongItems, correctItems = []) {
  const removed = new Set(correctItems.map((item) => `${item.year}-${item.no}`));
  const merged = new Map(current.filter((item) => !removed.has(`${item.year}-${item.no}`)).map((item) => [`${item.year}-${item.no}`, item]));
  for (const item of wrongItems) merged.set(`${item.year}-${item.no}`, { year: item.year, no: item.no });
  return [...merged.values()].sort((a, b) => b.year - a.year || a.no - b.no);
}
