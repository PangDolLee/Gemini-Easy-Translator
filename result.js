document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('main-container');
  
  const modelNames = {
    'gemini-2.5-pro': 'Gemini 2.5 Pro',
    'gemini-3.1-pro': 'Gemini 3.1 Pro',
    'gemini-2.5-flash-lite': 'Gemini 2.5 Flash Lite',
    'gemini-2.5-flash': 'Gemini 2.5 Flash',
    'gemini-3.1-flash-lite': 'Gemini 3.1 Flash Lite',
    'gemini-3.5-flash': 'Gemini 3.5 Flash'
  };

  chrome.storage.local.get(['pendingTranslation'], (data) => {
    const payload = data.pendingTranslation;
    
    if (!payload) {
      container.innerHTML = `<div style="color:#ff4d4f; font-weight:bold; text-align:center; padding:40px 0;">번역 데이터를 찾을 수 없습니다. 창을 닫고 다시 시도해주세요.</div>`;
      return;
    }

    document.documentElement.setAttribute('data-theme', payload.theme || 'light');
    document.documentElement.style.setProperty('--content-font-size', payload.fontSize || '14px');

    container.innerHTML = `<div class="loading">번역 중... 잠시만 기다려주세요.</div>`;

    chrome.runtime.sendMessage({ 
      action: "translate", 
      text: payload.text, 
      targetLang: payload.targetLang 
    }, (response) => {
      
      // 처리 후 데이터 초기화 (메모리 정리)
      chrome.storage.local.remove(['pendingTranslation']);

      if (chrome.runtime.lastError) {
        container.innerHTML = `<div style="color:#ff4d4f; font-weight:bold; text-align:center; padding:40px 0;">오류: ${chrome.runtime.lastError.message}</div>`;
        return;
      }

      if (response.error) {
        container.innerHTML = `<div style="color:#ff4d4f; font-weight:bold; text-align:center; padding:40px 0;">오류: ${response.error}</div>`;
      } else {
        const prettyModelName = modelNames[response.model] || response.model;
        const title = `${prettyModelName} ${response.lang} 번역 결과`;
        
        container.innerHTML = `
          <div class="header">${title}</div>
          <details>
            <summary class="section-title">원문 보기 (클릭하여 펼치기)</summary>
            <div class="content-box original">${payload.text}</div>
          </details>
          <div class="section-title">번역 결과</div>
          <div class="content-box" style="margin-bottom: 0;">${response.result}</div>
        `;
      }
    });
  });
});