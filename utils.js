(function (global) {
  // 마크다운 코드펜스와 style 속성만 제거하는 가벼운 텍스트 정리. background.js는
  // 서비스워커(DOM 없음)에서 실행되므로 여기서는 정규식으로 할 수 있는 최소한의
  // 작업만 한다. 빈 태그/중첩된 빈 래퍼 제거처럼 HTML 구조를 정확히 이해해야
  // 하는 작업은 실제 DOM이 있는 content.js의 pruneEmptyElements()가 담당한다
  // (정규식으로 태그 목록을 계속 나열하는 방식은 새로운 중첩 패턴마다 다시
  // 깨지므로 근본적인 해결책이 아니다).
  function cleanupTranslatedHtml(text) {
    if (!text) return '';
    let cleaned = text.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/i, '').trim();
    // 번역 프롬프트가 원본의 style 속성을 보존하도록 지시하고 있어, 원본 사이트의
    // width/padding/text-align 등 레이아웃 스타일이 고정폭 결과창에 그대로 유입되어
    // 좌우 여백이 들쭉날쭉해지는 원인이 된다. 구조 태그(b, a, ul 등)는 유지하고
    // style 속성만 제거한다.
    cleaned = cleaned.replace(/\s+style\s*=\s*(".*?"|'.*?')/gi, '');
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
