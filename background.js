chrome.runtime.onInstalled.addListener(() => {
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

function sendMessageToTab(tabId, message) {
  if (tabId) {
    chrome.tabs.sendMessage(tabId, message, () => {
      if (chrome.runtime.lastError) {
        console.warn("메시지 전송 실패 (콘텐츠 스크립트 미로드 또는 비활성 탭):", chrome.runtime.lastError.message);
      }
    });
  }
}

async function fetchImageAsBase64(url) {
  if (url.startsWith('data:')) {
    const [header, data] = url.split(',');
    const mimeType = header.split(':')[1].split(';')[0];
    return { mimeType, data };
  }
  const response = await fetch(url);
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

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "gemini-translate-text") {
    sendMessageToTab(tab.id, { action: "showLoading" });
    processTranslation(info.selectionText, tab.id, true, null, info.pageUrl || tab.url);
  } else if (info.menuItemId === "gemini-translate-image") {
    sendMessageToTab(tab.id, { action: "showLoading" });
    try {
      const imageData = await fetchImageAsBase64(info.srcUrl);
      processImageTranslation(imageData, tab.id, info.pageUrl || tab.url);
    } catch (error) {
      sendMessageToTab(tab.id, { action: "showResult", error: "이미지를 가져올 수 없습니다. (CORS 또는 보안 제한)" });
    }
  }
});

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

    const model = data.modelSelect || 'gemini-3.5-flash';
    const targetLang = requestedLang || data.targetLang || '한국어';
    
    const langMap = {
      '한국어': 'Korean',
      '영어': 'English',
      '일본어': 'Japanese',
      '중국어': 'Simplified Chinese'
    };
    const promptLang = langMap[targetLang] || targetLang;
    
    const presetPrompts = {
      'none': "",
      'summary': "Summarize the text in exactly 3 bullet points in the target language.",
      'business': "Use a formal and professional business tone (e.g., 하십시오체 in Korean).",
      'polite': "Use a standard polite and friendly tone (e.g., 해요체 in Korean).",
      'informal': "Use a casual and informal tone (e.g., 반말 in Korean)."
    };

    const selectedPreset = data.presetSelect || 'none';
    const presetInstruction = presetPrompts[selectedPreset] ? `\nStyle Instruction: ${presetPrompts[selectedPreset]}` : "";
    const customPrompt = data.customPrompt ? `\nAdditional Instructions: ${data.customPrompt}` : '';
    
    let glossaryInstruction = '';
    if (data.userDict && data.userDict.length > 0) {
      glossaryInstruction = "\n\nCRITICAL RULE - GLOSSARY:\nYou MUST translate the following specific terms exactly as provided below:\n";
      data.userDict.forEach(item => {
        glossaryInstruction += `- "${item.key}" -> "${item.val}"\n`;
      });
    }
    
    const prompt = `You are a professional HTML content translator. Translate the content enclosed in <source_content> tags into ${promptLang}.
CRITICAL RULES:
1. You MUST preserve all original HTML tags, attributes (like href, class, style), Markdown formatting, line breaks, bullet points, and structures exactly as they appear in the source.
2. Only translate the human-readable text content inside the HTML elements. Do not translate the HTML tags themselves.
3. Return ONLY the translated HTML content. Do NOT output original text, extra explanations, or markdown code blocks (like \`\`\`html).
4. ABSOLUTELY DO NOT add any extra line breaks (\n), <br> tags, or empty <p> tags. Maintain the exact same block element structure as the source. Do not arbitrarily wrap unwrapped text in new tags.
5. If the source content contains multiple paragraphs or line breaks, you MUST maintain them in the output using <p> or <br> tags. DO NOT merge separate paragraphs into a single continuous block.${presetInstruction}${customPrompt}${glossaryInstruction}

<source_content>
${textToTranslate}
</source_content>`;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${data.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      const resultData = await response.json();
      
      if (resultData.error) {
        sendResult({ error: resultData.error.message });
      } else if (!resultData.candidates || !resultData.candidates[0].content) {
        sendResult({ error: "API 응답이 유효하지 않거나 안전성 정책에 의해 차단되었습니다." });
      } else {
        let translatedText = resultData.candidates[0].content.parts[0].text;
        translatedText = translatedText.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/i, '').trim();
        translatedText = translatedText.replace(/<(p|div)[^>]*>(\s|<br\s*\/?>|&nbsp;)*<\/\1>/gi, '');
        translatedText = translatedText.replace(/(?:<br\s*\/?>|\n|\r|\s)+$/gi, '');

        sendResult({ result: translatedText, model: model, lang: targetLang });

        const stripHtml = (html) => {
          if (!html) return '';
          let textWithAlt = html.replace(/<img[^>]+alt=(["'])(.*?)\1[^>]*>/gi, '$2');
          return textWithAlt.replace(/<[^>]*>?/gm, '').trim();
        };
        
        const pureOriginalText = stripHtml(textToTranslate) || textToTranslate;
        const pureTranslatedText = stripHtml(translatedText) || translatedText;

        chrome.storage.local.get(['translationHistory'], (histData) => {
          let history = histData.translationHistory || [];
          history.unshift({
            original: pureOriginalText,
            translated: pureTranslatedText,
            timestamp: new Date().getTime(),
            url: sourceUrl
          });
          if (history.length > 50) history = history.slice(0, 50);
          chrome.storage.local.set({ translationHistory: history });
        });
      }
    } catch (error) {
      sendResult({ error: error.toString() });
    }
  });
}

function processImageTranslation(imageData, tabId, sourceUrl) {
  chrome.storage.local.get(['apiKey', 'modelSelect', 'targetLang', 'presetSelect', 'customPrompt'], async (data) => {
    if (!data.apiKey) {
      sendMessageToTab(tabId, { action: "showResult", error: "확장 프로그램 팝업에서 API 키를 먼저 설정하세요." });
      return;
    }

    const model = data.modelSelect || 'gemini-3.5-flash';
    const targetLang = data.targetLang || '한국어';
    
    const langMap = {
      '한국어': 'Korean',
      '영어': 'English',
      '일본어': 'Japanese',
      '중국어': 'Simplified Chinese'
    };
    const promptLang = langMap[targetLang] || targetLang;

    const customPrompt = data.customPrompt ? `\nAdditional Instructions: ${data.customPrompt}` : '';

    const prompt = `You are a professional translator and OCR expert. Extract all readable text from the provided image and translate it into ${promptLang}.
CRITICAL RULES:
1. Output ONLY the translated text.
2. Do NOT include the original text unless it's impossible to translate (like proper nouns).
3. Maintain the logical reading order and paragraph structure of the original image.${customPrompt}`;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${data.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: imageData.mimeType,
                  data: imageData.data
                }
              }
            ]
          }]
        })
      });

      const resultData = await response.json();
      
      if (resultData.error) {
        sendMessageToTab(tabId, { action: "showResult", error: resultData.error.message });
      } else if (!resultData.candidates || !resultData.candidates[0].content) {
        sendMessageToTab(tabId, { action: "showResult", error: "API 응답이 유효하지 않거나 안전성 정책에 의해 차단되었습니다." });
      } else {
        const translatedText = resultData.candidates[0].content.parts[0].text;
        sendMessageToTab(tabId, { action: "showResult", result: translatedText, model: model, lang: targetLang, isHTML: false });
        
        chrome.storage.local.get(['translationHistory'], (histData) => {
          let history = histData.translationHistory || [];
          history.unshift({
            original: "[이미지에서 텍스트 추출 됨]",
            translated: translatedText,
            timestamp: new Date().getTime(),
            url: sourceUrl
          });
          if (history.length > 50) history = history.slice(0, 50);
          chrome.storage.local.set({ translationHistory: history });
        });
      }
    } catch (error) {
      sendMessageToTab(tabId, { action: "showResult", error: error.toString() });
    }
  });
}