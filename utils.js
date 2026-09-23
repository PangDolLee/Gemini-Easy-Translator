(function (global) {
  function cleanupTranslatedHtml(text) {
    if (!text) return '';
    let cleaned = text.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/i, '').trim();
    // 번역 프롬프트가 원본의 style 속성을 보존하도록 지시하고 있어, 원본 사이트의
    // width/padding/text-align 등 레이아웃 스타일이 고정폭 결과창에 그대로 유입되어
    // 좌우 여백이 들쭉날쭉해지는 원인이 된다. 구조 태그(b, a, ul 등)는 유지하고
    // style 속성만 제거한다.
    cleaned = cleaned.replace(/\s+style\s*=\s*(".*?"|'.*?')/gi, '');
    cleaned = cleaned.replace(/<(p|div)[^>]*>(\s|<br\s*\/?>|&nbsp;)*<\/\1>/gi, '');
    cleaned = cleaned.replace(/(?:<br\s*\/?>|\n|\r|\s)+$/gi, '');
    return cleaned;
  }

  function stripHtml(html) {
    if (!html) return '';
    const textWithAlt = html.replace(/<img[^>]+alt=(["'])(.*?)\1[^>]*>/gi, '$2');
    return textWithAlt.replace(/<[^>]*>?/gm, '').trim();
  }

  const utils = { cleanupTranslatedHtml, stripHtml };

  if (typeof module === 'object' && module.exports) {
    module.exports = utils;
  } else {
    global.GeminiTranslatorUtils = utils;
  }
})(typeof self !== 'undefined' ? self : this);
