chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "gemini-translate",
    title: "Gemini로 번역하기",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "gemini-translate") {
    chrome.tabs.sendMessage(tab.id, { action: "showLoading" });
    processTranslation(info.selectionText, tab.id, true, null, info.pageUrl || tab.url);
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
        chrome.tabs.sendMessage(tabId, { action: "showResult", ...resultObj });
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
    
    // HTML 구조 유지를 위한 엄격한 지시문 추가
    const prompt = `You are a professional HTML content translator. Translate the content enclosed in <source_content> tags into ${targetLang}.
CRITICAL RULES:
1. You MUST preserve all original HTML tags, attributes (like href, class, style), Markdown formatting, line breaks, bullet points, and structures exactly as they appear in the source.
2. Only translate the human-readable text content inside the HTML elements. Do not translate the HTML tags themselves.
3. Return ONLY the translated HTML content. Do NOT output original text, extra explanations, or markdown code blocks (like \`\`\`html).${presetInstruction}${customPrompt}${glossaryInstruction}

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
      } else {
        let translatedText = resultData.candidates[0].content.parts[0].text;
        
        // Gemini가 불필요하게 ```html 마크다운 블록을 추가하여 응답한 경우 제거
        translatedText = translatedText.replace(/^```html\s*/i, '').replace(/\s*```$/i, '').trim();

        sendResult({ result: translatedText, model: model, lang: targetLang });

        // 기록 저장을 위해 HTML 태그를 제거한 순수 텍스트만 추출
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = textToTranslate;
        const pureOriginalText = tempDiv.textContent || tempDiv.innerText || textToTranslate;
        
        tempDiv.innerHTML = translatedText;
        const pureTranslatedText = tempDiv.textContent || tempDiv.innerText || translatedText;

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