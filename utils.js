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

  const utils = { cleanupTranslatedHtml, stripHtml };

  if (typeof module === 'object' && module.exports) {
    module.exports = utils;
  } else {
    global.GeminiTranslatorUtils = utils;
  }
})(typeof self !== 'undefined' ? self : this);
