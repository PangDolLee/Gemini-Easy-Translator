(function (global) {
  const LANG_MAP = {
    '한국어': 'Korean',
    '영어': 'English',
    '일본어': 'Japanese',
    '중국어': 'Simplified Chinese'
  };

  const LANGS = Object.keys(LANG_MAP);

  const MODEL_NAMES = {
    'gemini-2.5-pro': 'Gemini 2.5 Pro',
    'gemini-3.1-pro': 'Gemini 3.1 Pro',
    'gemini-2.5-flash-lite': 'Gemini 2.5 Flash Lite',
    'gemini-2.5-flash': 'Gemini 2.5 Flash',
    'gemini-3.1-flash-lite': 'Gemini 3.1 Flash Lite',
    'gemini-3.5-flash': 'Gemini 3.5 Flash'
  };

  const PRESET_PROMPTS = {
    'none': "",
    'summary': "Summarize the text in exactly 3 bullet points in the target language.",
    'business': "Use a formal and professional business tone (e.g., 하십시오체 in Korean).",
    'polite': "Use a standard polite and friendly tone (e.g., 해요체 in Korean).",
    'informal': "Use a casual and informal tone (e.g., 반말 in Korean)."
  };

  const DEFAULT_MODEL = 'gemini-3.5-flash';
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
