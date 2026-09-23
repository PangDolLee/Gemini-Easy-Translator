importScripts('constants.js', 'utils.js');

const { LANG_MAP, PRESET_PROMPTS, DEFAULT_MODEL, DEFAULT_TARGET_LANG } = self.GeminiTranslatorConstants;
const { cleanupTranslatedHtml, stripHtml } = self.GeminiTranslatorUtils;

const REQUEST_TIMEOUT_MS = 30000;
const MAX_RETRIES = 2;
const MAX_CACHE_SIZE = 30;
const MAX_CACHEABLE_TEXT_LENGTH = 5000;

const translationCache = new Map();

function getCachedResult(key) {
  return translationCache.get(key);
}

function setCachedResult(key, value) {
  if (translationCache.has(key)) translationCache.delete(key);
  translationCache.set(key, value);
  if (translationCache.size > MAX_CACHE_SIZE) {
    const oldestKey = translationCache.keys().next().value;
    translationCache.delete(oldestKey);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "gemini-translate-text",
      title: "Gemini로 텍스트 번역",
      contexts: ["selection"]
    });
    chrome.contextMenus.create({
      id: "gemini-translate-image",
      title: "Gemini로 이미지 번역",
      contexts: ["image"]
    });
  });
});

function sendMessageToTab(tabId, message) {
  if (tabId) {
    chrome.tabs.sendMessage(tabId, message, () => {
      if (chrome.runtime.lastError) {
        console.warn("메시지 전송 실패 (콘텐츠 스크립트 미로드 또는 비활성 탭):", chrome.runtime.lastError.message);
      }
    });
  }
}

async function fetchWithRetry(url, options) {
  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      const isRetryableStatus = response.status === 429 || response.status >= 500;
      if (isRetryableStatus && attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
        continue;
      }
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;
      if (error.name === 'AbortError') {
        lastError = new Error('요청 시간이 초과되었습니다. 네트워크 상태를 확인해주세요.');
        break;
      }
      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
        continue;
      }
    }
  }
  throw lastError || new Error('알 수 없는 오류로 요청에 실패했습니다.');
}

async function requestGeminiContent(model, apiKey, parts, useThinkingConfig) {
  const body = { contents: [{ parts }] };
  if (useThinkingConfig) {
    // 번역/OCR은 다단계 추론이 필요 없는 작업이므로 thinking을 꺼서
    // Flash 모델에서 불필요하게 응답이 지연되는 것을 방지한다.
    body.generationConfig = { thinkingConfig: { thinkingBudget: 0 } };
  }

  const response = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    if (response.status === 429) {
      const error = new Error('API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.');
      error.status = 429;
      throw error;
    }
    let message = `API 요청에 실패했습니다. (HTTP ${response.status})`;
    try {
      const errBody = await response.json();
      if (errBody?.error?.message) message = errBody.error.message;
    } catch (e) {
      // 응답 본문이 JSON이 아닌 경우 기본 메시지를 사용
    }
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  const resultData = await response.json();
  if (resultData.error) {
    throw new Error(resultData.error.message);
  }
  if (!resultData.candidates || !resultData.candidates[0].content) {
    throw new Error('API 응답이 유효하지 않거나 안전성 정책에 의해 차단되었습니다.');
  }
  return resultData.candidates[0].content.parts[0].text;
}

async function callGeminiApi(model, apiKey, parts) {
  try {
    return await requestGeminiContent(model, apiKey, parts, true);
  } catch (error) {
    // 일부 모델이 thinkingConfig 필드를 지원하지 않아 400을 반환하는 경우에만
    // 해당 옵션 없이 한 번 더 시도한다(속도 최적화가 요청 자체를 막지 않도록).
    if (error.status === 400) {
      return requestGeminiContent(model, apiKey, parts, false);
    }
    throw error;
  }
}

function pushHistory(entry) {
  chrome.storage.local.get(['translationHistory'], (histData) => {
    let history = histData.translationHistory || [];
    history.unshift(entry);
    if (history.length > 50) history = history.slice(0, 50);
    chrome.storage.local.set({ translationHistory: history });
  });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "gemini-translate-text") {
    sendMessageToTab(tab.id, { action: "showLoading" });
    processTranslation(info.selectionText, tab.id, true, null, info.pageUrl || tab.url);
  } else if (info.menuItemId === "gemini-translate-image") {
    sendMessageToTab(tab.id, { action: "showLoading" });
    try {
      const imageData = await fetchImageAsBase64(info.srcUrl, info.pageUrl || tab.url);
      processImageTranslation(imageData, tab.id, info.pageUrl || tab.url);
    } catch (error) {
      const message = error && error.status === 403
        ? "이미지 서버가 요청을 거부했습니다. (핫링크/리퍼러 차단, HTTP 403)"
        : "이미지를 가져올 수 없습니다. (CORS 또는 보안 제한)";
      sendMessageToTab(tab.id, { action: "showResult", error: message });
    }
  }
});

let dnrRuleIdCounter = 1;
function nextDnrRuleId() {
  dnrRuleIdCounter = dnrRuleIdCounter >= 200000 ? 1 : dnrRuleIdCounter + 1;
  return dnrRuleIdCounter;
}

// pixiv 등 일부 사이트는 Referer 헤더로 핫링크를 차단한다. fetch()의 referrer/
// referrerPolicy 옵션은 확장 프로그램 서비스워커에서 신뢰할 수 없어(크롬이 무시하거나
// 재작성하는 경우가 있음), declarativeNetRequest로 실제 전송되는 요청의 Referer
// 헤더 자체를 이미지 서버 도메인에 한해 일시적으로 덮어쓴다.
async function withForcedReferer(targetUrl, refererUrl, task) {
  if (!refererUrl) return task();
  let hostname;
  try {
    hostname = new URL(targetUrl).hostname;
  } catch (e) {
    return task();
  }

  const ruleId = nextDnrRuleId();
  const rule = {
    id: ruleId,
    priority: 1,
    action: {
      type: 'modifyHeaders',
      requestHeaders: [{ header: 'Referer', operation: 'set', value: refererUrl }]
    },
    condition: {
      urlFilter: `||${hostname}^`,
      resourceTypes: ['xmlhttprequest', 'other', 'image']
    }
  };

  try {
    await chrome.declarativeNetRequest.updateSessionRules({ addRules: [rule] });
  } catch (e) {
    console.warn('Referer 헤더 규칙 등록 실패, 기본 요청으로 진행합니다:', e.message);
    return task();
  }

  try {
    return await task();
  } finally {
    chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [ruleId] }).catch(() => {});
  }
}

async function fetchImageAsBase64(url, refererUrl) {
  if (url.startsWith('data:')) {
    const [header, data] = url.split(',');
    const mimeType = header.split(':')[1].split(';')[0];
    return { mimeType, data };
  }
  const response = await withForcedReferer(url, refererUrl, () => fetch(url));
  if (!response.ok) {
    const error = new Error(`이미지 요청 실패 (HTTP ${response.status})`);
    error.status = response.status;
    throw error;
  }
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result;
      const [header, data] = base64data.split(',');
      resolve({ mimeType: blob.type || 'image/jpeg', data });
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "translate") {
    const sourceUrl = sender.tab ? sender.tab.url : "직접 입력함";
    processTranslation(request.text, sender.tab ? sender.tab.id : null, false, sendResponse, sourceUrl, request.targetLang);
    return true;
  }
});

function processTranslation(textToTranslate, tabId, isContextMenu, sendResponseCallback = null, sourceUrl = "직접 입력함", requestedLang = null) {
  chrome.storage.local.get(['apiKey', 'modelSelect', 'targetLang', 'presetSelect', 'customPrompt', 'userDict'], async (data) => {

    function sendResult(resultObj) {
      if (isContextMenu && tabId) {
        sendMessageToTab(tabId, { action: "showResult", ...resultObj });
      } else if (sendResponseCallback) {
        sendResponseCallback(resultObj);
      }
    }

    if (!data.apiKey) {
      sendResult({ error: "확장 프로그램 팝업에서 API 키를 먼저 설정하세요." });
      return;
    }

    const model = data.modelSelect || DEFAULT_MODEL;
    const targetLang = requestedLang || data.targetLang || DEFAULT_TARGET_LANG;
    const promptLang = LANG_MAP[targetLang] || targetLang;

    const selectedPreset = data.presetSelect || 'none';
    const presetInstruction = PRESET_PROMPTS[selectedPreset] ? `\nStyle Instruction: ${PRESET_PROMPTS[selectedPreset]}` : "";
    const customPrompt = data.customPrompt ? `\nAdditional Instructions: ${data.customPrompt}` : '';

    let glossaryInstruction = '';
    if (data.userDict && data.userDict.length > 0) {
      glossaryInstruction = "\n\nCRITICAL RULE - GLOSSARY:\nYou MUST translate the following specific terms exactly as provided below:\n";
      data.userDict.forEach(item => {
        glossaryInstruction += `- "${item.key}" -> "${item.val}"\n`;
      });
    }

    const cacheKey = textToTranslate.length <= MAX_CACHEABLE_TEXT_LENGTH
      ? JSON.stringify({ model, promptLang, selectedPreset, customPrompt: data.customPrompt || '', userDict: data.userDict || [], textToTranslate })
      : null;

    function recordHistoryAndRespond(translatedText) {
      sendResult({ result: translatedText, model, lang: targetLang });

      const pureOriginalText = stripHtml(textToTranslate) || textToTranslate;
      const pureTranslatedText = stripHtml(translatedText) || translatedText;
      pushHistory({
        original: pureOriginalText,
        translated: pureTranslatedText,
        timestamp: new Date().getTime(),
        url: sourceUrl
      });
    }

    if (cacheKey && translationCache.has(cacheKey)) {
      recordHistoryAndRespond(getCachedResult(cacheKey));
      return;
    }

    const prompt = `You are a professional HTML content translator. Translate the content enclosed in <source_content> tags into ${promptLang}.
CRITICAL RULES:
1. You MUST preserve all original HTML tags, attributes (like href, class), Markdown formatting, line breaks, bullet points, and structures exactly as they appear in the source. Do NOT include "style" attributes in the output even if present in the source, since the translated content is rendered in a fixed-width viewer with its own styling.
2. Only translate the human-readable text content inside the HTML elements. Do not translate the HTML tags themselves.
3. Return ONLY the translated HTML content. Do NOT output original text, extra explanations, or markdown code blocks (like \`\`\`html).
4. ABSOLUTELY DO NOT add any extra line breaks (\n), <br> tags, or empty <p> tags. Maintain the exact same block element structure as the source. Do not arbitrarily wrap unwrapped text in new tags.
5. If the source content contains multiple paragraphs or line breaks, you MUST maintain them in the output using <p> or <br> tags. DO NOT merge separate paragraphs into a single continuous block.${presetInstruction}${customPrompt}${glossaryInstruction}

<source_content>
${textToTranslate}
</source_content>`;

    try {
      const rawText = await callGeminiApi(model, data.apiKey, [{ text: prompt }]);
      const translatedText = cleanupTranslatedHtml(rawText);

      if (cacheKey) setCachedResult(cacheKey, translatedText);
      recordHistoryAndRespond(translatedText);
    } catch (error) {
      sendResult({ error: error.message || error.toString() });
    }
  });
}

function processImageTranslation(imageData, tabId, sourceUrl) {
  chrome.storage.local.get(['apiKey', 'modelSelect', 'targetLang', 'presetSelect', 'customPrompt'], async (data) => {
    if (!data.apiKey) {
      sendMessageToTab(tabId, { action: "showResult", error: "확장 프로그램 팝업에서 API 키를 먼저 설정하세요." });
      return;
    }

    const model = data.modelSelect || DEFAULT_MODEL;
    const targetLang = data.targetLang || DEFAULT_TARGET_LANG;
    const promptLang = LANG_MAP[targetLang] || targetLang;
    const customPrompt = data.customPrompt ? `\nAdditional Instructions: ${data.customPrompt}` : '';

    const prompt = `You are a professional translator and OCR expert. Extract all readable text from the provided image and translate it into ${promptLang}.
CRITICAL RULES:
1. Output ONLY the translated text.
2. Do NOT include the original text unless it's impossible to translate (like proper nouns).
3. Maintain the logical reading order and paragraph structure of the original image.${customPrompt}`;

    try {
      const translatedText = await callGeminiApi(model, data.apiKey, [
        { text: prompt },
        { inlineData: { mimeType: imageData.mimeType, data: imageData.data } }
      ]);

      sendMessageToTab(tabId, { action: "showResult", result: translatedText, model, lang: targetLang, isHTML: false });
      pushHistory({
        original: "[이미지에서 텍스트 추출 됨]",
        translated: translatedText,
        timestamp: new Date().getTime(),
        url: sourceUrl
      });
    } catch (error) {
      sendMessageToTab(tabId, { action: "showResult", error: error.message || error.toString() });
    }
  });
}
