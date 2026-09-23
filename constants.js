(function (global) {
  const LANG_MAP = {
    '한국어': 'Korean',
    '영어': 'English',
    '일본어': 'Japanese',
    '중국어': 'Simplified Chinese'
  };

  const LANGS = Object.keys(LANG_MAP);

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

  const BASE_TONE_INSTRUCTION = "Use a plain, informational statement style focused on conveying facts, not conversational politeness (e.g., 해라체/평서체 sentence endings like '~다', '~인가?' in Korean).";

  const PRESET_PROMPTS = {
    'none': BASE_TONE_INSTRUCTION,
    'business': "Use a formal, professional tone suitable for a business email (e.g., 하십시오체 sentence endings like '~입니다', '~입니다만', '~입니까?', '~을 부탁드립니다' in Korean)."
  };

  const PRESET_LABELS = {
    'none': '설정 없음 (기본)',
    'summary': '핵심 요약',
    'business': '비즈니스 메일'
  };

  const DEFAULT_MODEL = 'gemini-3.8-flash';
  const DEFAULT_TARGET_LANG = '한국어';
  const LONG_TEXT_THRESHOLD = 1000;

  const constants = {
    LANG_MAP,
    LANGS,
    MODEL_NAMES,
    BASE_TONE_INSTRUCTION,
    PRESET_PROMPTS,
    PRESET_LABELS,
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
