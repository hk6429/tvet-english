const TAGS = {
  vocabulary: { cat: "C1", tags: ["語境選字"] },
  dialogue: { cat: "C3", tags: ["情境對話"] },
  cloze: { cat: "C4", tags: ["段落語意"] },
  reading: { cat: "C5", tags: ["明示訊息"] },
};

export function classifyQuestion(section, stem) {
  if (section !== "reading") return TAGS[section] ?? TAGS.vocabulary;
  if (/NOT\b|not true|except\b/i.test(stem)) return { cat: "C5", tags: ["反向細節"] };
  if (/main (?:idea|purpose)|best title|mainly (?:about|discuss|concern)/i.test(stem)) return { cat: "C6", tags: ["主旨判斷"] };
  if (/infer|imply|probably|most likely|conclude/i.test(stem)) return { cat: "C6", tags: ["語意推論"] };
  if (/chart|graph|table|diagram|picture|map/i.test(stem)) return { cat: "C5", tags: ["圖表判讀"] };
  return TAGS.reading;
}

export function explanationFor(question, section) {
  const correct = question.options[question.answer] || `選項 ${question.answer}`;
  if (correct.includes("圖像選項")) {
    return `官方答案為 ${question.answer}。本題需對照下方官方原卷圖判斷，正確圖像是選項 ${question.answer}；作答時應逐一核對圖中的標示、數量或趨勢。`;
  }
  if (section === "vocabulary") {
    return `官方答案為 ${question.answer}。將「${correct}」代回原句，字義、詞性與上下文搭配皆合理；其餘選項無法同時符合句意與句構。`;
  }
  if (section === "dialogue") {
    return `官方答案為 ${question.answer}。依對話前後句的問答關係，「${correct}」能自然承接說話情境；其他選項會造成答非所問或語意跳接。`;
  }
  if (section === "cloze") {
    return `官方答案為 ${question.answer}。把「${correct}」放入第 ${question.no} 空後，前後文語意與句子結構能完整銜接；其餘選項不符合該處的文意或文法。`;
  }
  return `官方答案為 ${question.answer}。依題目要求回到本文定位資訊，「${correct}」與文章明示或可合理推得的內容一致；其餘選項與原文不符。`;
}
