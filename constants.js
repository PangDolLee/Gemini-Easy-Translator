(function (global) {
  const LANG_MAP = {
    '한국어': 'Korean',
    '영어': 'English',
    '일본어': 'Japanese',
    '중국어': 'Simplified Chinese'
  };

  const LANGS = Object.keys(LANG_MAP);

  // 2026-09 기준 Gemini API 모델 목록. gemini-2.5-* 계열은 2026-10-16(Gemini
  // Developer API 기준) 지원 종료가 예고된 적이 있어(공지가 번복된 전례가 있음)
  // 완전히 제거하지 않고 라벨로 안내만 남긴다.
  const MODEL_NAMES = {
    'gemini-3.8-flash': 'Gemini 3.8 Flash (최신)',
    'gemini-3.7-flash': 'Gemini 3.7 Flash',
    'gemini-3.6-flash': 'Gemini 3.6 Flash',
    'gemini-3.5-flash': 'Gemini 3.5 Flash',
    'gemini-3.1-flash-lite': 'Gemini 3.1 Flash-Lite',
    'gemini-3.1-pro': 'Gemini 3.1 Pro',
    'gemini-2.5-pro': 'Gemini 2.5 Pro (지원 종료 예정)',
    'gemini-2.5-flash': 'Gemini 2.5 Flash (지원 종료 예정)',
    'gemini-2.5-flash-lite': 'Gemini 2.5 Flash-Lite (지원 종료 예정)'
  };

  const PRESET_PROMPTS = {
    'none': "",
    'summary': "Summarize the text in exactly 3 bullet points in the target language.",
    'business': "Use a formal and professional business tone (e.g., 하십시오체 in Korean).",
    'polite': "Use a standard polite and friendly tone (e.g., 해요체 in Korean).",
    'informal': "Use a casual and informal tone (e.g., 반말 in Korean)."
  };

  const DEFAULT_MODEL = 'gemini-3.8-flash';
  const DEFAULT_TARGET_LANG = '한국어';
  const LONG_TEXT_THRESHOLD = 1000;

  const constants = {
    LANG_MAP,
    LANGS,
    MODEL_NAMES,
    PRESET_PROMPTS,
    DEFAULT_MODEL,
    DEFAULT_TARGET_LANG,
    LONG_TEXT_THRESHOLD
  };

  if (typeof module === 'object' && module.exports) {
    module.exports = constants;
  } else {
    global.GeminiTranslatorConstants = constants;
  }
})(typeof self !== 'undefined' ? self : this);
