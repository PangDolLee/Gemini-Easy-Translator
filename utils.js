(function (global) {
  function cleanupTranslatedHtml(text) {
    if (!text) return '';
    let cleaned = text.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/i, '').trim();
    cleaned = cleaned.replace(/<(p|div)[^>]*>(\s|<br\s*\/?>|&nbsp;)*<\/\1>/gi, '');
    cleaned = cleaned.replace(/(?:<br\s*\/?>|\n|\r|\s)+$/gi, '');
    return cleaned;
  }

  function stripHtml(html) {
    if (!html) return '';
    const textWithAlt = html.replace(/<img[^>]+alt=(["'])(.*?)\1[^>]*>/gi, '$2');
    return textWithAlt.replace(/<[^>]*>?/gm, '').trim();
  }

  function buildNumberedListPrompt(texts, promptLang) {
    const list = texts.map((t, i) => `${i + 1}. ${t.replace(/\s+/g, ' ').trim()}`).join('\n');
    return `You are a professional web page translator. Translate each numbered line below into ${promptLang}.
CRITICAL RULES:
1. Return ONLY the translated list, using the exact same numbering format ("N. text").
2. Preserve the exact number of lines and their order. Do NOT merge, split, add, or remove lines.
3. Do NOT translate or alter the numbers themselves, only the text after each number.
4. If a line is not translatable (a proper noun, code, or a number), return it unchanged.
5. Do NOT add explanations, markdown code blocks, or any text outside the numbered list.

${list}`;
  }

  // Gemini가 돌려준 "N. 번역문" 형식의 응답을 원래 배열 순서로 되돌린다.
  // 파싱에 실패한 라인은 null로 두어 호출부가 원문을 그대로 유지하게 한다.
  function parseNumberedList(rawText, expectedCount) {
    const result = new Array(expectedCount).fill(null);
    if (!rawText) return result;
    const lines = rawText.split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*(\d+)[.).]\s*(.*)$/);
      if (!match) continue;
      const index = parseInt(match[1], 10) - 1;
      if (index >= 0 && index < expectedCount) {
        result[index] = match[2].trim();
      }
    }
    return result;
  }

  const utils = { cleanupTranslatedHtml, stripHtml, buildNumberedListPrompt, parseNumberedList };

  if (typeof module === 'object' && module.exports) {
    module.exports = utils;
  } else {
    global.GeminiTranslatorUtils = utils;
  }
})(typeof self !== 'undefined' ? self : this);
