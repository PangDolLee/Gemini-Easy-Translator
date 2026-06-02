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
    processTranslation(info.selectionText, tab.id, true);
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "translate") {
    processTranslation(request.text, sender.tab ? sender.tab.id : null, false, sendResponse);
    return true; 
  }
});

// 번역 처리를 담당하는 공통 함수
function processTranslation(textToTranslate, tabId, isContextMenu, sendResponseCallback = null) {
  chrome.storage.local.get(['apiKey', 'modelSelect', 'targetLang', 'customPrompt', 'userDict'], async (data) => {
    
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
    const targetLang = data.targetLang || '한국어';
    
    // 1. 추가 프롬프트 구성
    const customPrompt = data.customPrompt ? `\nAdditional Instructions: ${data.customPrompt}` : '';
    
    // 2. 사용자 사전(Glossary) 구성
    let glossaryInstruction = '';
    if (data.userDict && data.userDict.length > 0) {
      glossaryInstruction = "\n\nCRITICAL RULE - GLOSSARY:\nYou MUST translate the following specific terms exactly as provided below. Do not deviate from these translations:\n";
      data.userDict.forEach(item => {
        glossaryInstruction += `- "${item.key}" -> "${item.val}"\n`;
      });
    }
    
    // 3. 최종 프롬프트 조합
    const prompt = `Translate the following text to ${targetLang}. Only provide the translated text without any extra explanations or quotes.${customPrompt}${glossaryInstruction}\n\n[Text to translate]:\n${textToTranslate}`;

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
      }
    } catch (error) {
      sendResult({ error: error.toString() });
    }
  });
}
