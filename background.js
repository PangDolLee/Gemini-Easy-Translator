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
    // request.targetLang 파라미터를 추가로 전달
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
    
    // 요청받은 언어가 있으면 최우선으로 사용, 없으면 저장된 값 사용
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
    
    const prompt = `You are a professional translator. Translate the text enclosed in <source_text> tags into ${targetLang}.
Return ONLY the translated result. Do NOT output original text or extra explanations.${presetInstruction}${customPrompt}${glossaryInstruction}

<source_text>
${textToTranslate}
</source_text>`;

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
        const translatedText = resultData.candidates[0].content.parts[0].text;
        sendResult({ result: translatedText, model: model, lang: targetLang });

        chrome.storage.local.get(['translationHistory'], (histData) => {
          let history = histData.translationHistory || [];
          history.unshift({
            original: textToTranslate,
            translated: translatedText,
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