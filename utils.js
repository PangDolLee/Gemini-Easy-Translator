(function (global) {
  function cleanupTranslatedHtml(text) {
    if (!text) return '';
    let cleaned = text.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/i, '').trim();
    // 번역 프롬프트가 원본의 style 속성을 보존하도록 지시하고 있어, 원본 사이트의
    // width/padding/text-align 등 레이아웃 스타일이 고정폭 결과창에 그대로 유입되어
    // 좌우 여백이 들쭉날쭉해지는 원인이 된다. 구조 태그(b, a, ul 등)는 유지하고
    // style 속성만 제거한다.
    cleaned = cleaned.replace(/\s+style\s*=\s*(".*?"|'.*?')/gi, '');
    // 원문 구조를 보존하는 과정에서 빈 제목(h1~h6)이나 빈 블록 요소가 그대로
    // 남으면, 결과창이 리셋하지 않은 브라우저 기본 여백(margin) 때문에 위쪽에
    // 불필요한 빈 공간이 생긴다. p/div뿐 아니라 이런 태그들도 비어 있으면 제거한다.
    cleaned = cleaned.replace(/<(p|div|h[1-6]|blockquote|li|dt|dd|section|article|header|footer|aside|figure|figcaption)[^>]*>(\s|<br\s*\/?>|&nbsp;)*<\/\1>/gi, '');
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
