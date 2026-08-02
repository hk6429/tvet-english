const SOURCE = "https://web1.tcte.edu.tw/EXAM/115_4y/";

const TABLES = {
  115: {
    difficulty: {
      "困難": [3, 4, 6, 8, 21, 22, 26, 27, 28, 32, 34, 36, 40, 41],
      "中等": [1, 5, 7, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 23, 24, 25, 29, 30, 31, 33, 35, 37, 38, 39, 42],
      "容易": [2],
    },
    discrimination: {
      "不佳": [],
      "可": [26],
      "佳": [34],
      "優": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 27, 28, 29, 30, 31, 32, 33, 35, 36, 37, 38, 39, 40, 41, 42],
    },
  },
};

function expand(year, table) {
  const count = 42;
  const items = Object.fromEntries(Array.from({ length: count }, (_, index) => [index + 1, { year, no: index + 1 }]));
  for (const [dimension, groups] of Object.entries(table)) {
    const seen = new Set();
    for (const [label, numbers] of Object.entries(groups)) {
      for (const no of numbers) {
        if (!items[no] || seen.has(no)) throw new Error(`${year} ${dimension} 題號重複或超出範圍：${no}`);
        seen.add(no);
        items[no][dimension] = label;
      }
    }
    if (seen.size !== count) throw new Error(`${year} ${dimension} 僅覆蓋 ${seen.size}/${count} 題`);
  }
  return { source: SOURCE, items };
}

export const OFFICIAL_METRICS = Object.fromEntries(
  Object.entries(TABLES).map(([year, table]) => [year, expand(Number(year), table)]),
);

export function matchingNumbers(year, difficulty = "全部", discrimination = "全部") {
  const dataset = OFFICIAL_METRICS[year];
  if (!dataset) return [];
  return Object.values(dataset.items)
    .filter((item) => difficulty === "全部" || item.difficulty === difficulty)
    .filter((item) => discrimination === "全部" || item.discrimination === discrimination)
    .map((item) => item.no);
}

export function difficultyRank(label) {
  return { "容易": 0, "中等": 1, "困難": 2 }[label] ?? 99;
}
