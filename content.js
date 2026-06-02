let translateBtn = null;
let resultBox = null;
let selectedText = '';
let lastMouseX = 0;
let lastMouseY = 0;

// 우클릭 위치 저장 (우클릭 메뉴 번역창 띄우기 용도)
document.addEventListener('contextmenu', (e) => {
  lastMouseX = e.pageX;
  lastMouseY = e.pageY;
});

// 백그라운드 스크립트로부터의 우클릭 번역 요청/결과 메시지 수신
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "showLoading") {
    showResult('번역 중...', lastMouseX, lastMouseY);
  } else if (request.action === "showResult") {
    if (request.error) {
      showResult(`오류: ${request.error}`, lastMouseX, lastMouseY);
    } else {
      const modelNames = {
        'gemini-2.5-pro': 'Gemini 2.5 Pro',
        'gemini-3.1-pro': 'Gemini 3.1 Pro',
        'gemini-3.1-flash-lite': 'Gemini 3.1 Flash Lite',
        'gemini-3.5-flash': 'Gemini 3.5 Flash'
      };
      const prettyModelName = modelNames[request.model] || request.model;
      const title = `${prettyModelName} ${request.lang} 번역 결과`;
      
      showResult(request.result, lastMouseX, lastMouseY, title);
    }
  }
});

document.addEventListener('mouseup', (e) => {
  if (e.target.closest('#gemini-translate-btn') || e.target.closest('#gemini-translate-result-container')) return;

  setTimeout(() => {
    selectedText = window.getSelection().toString().trim();
    
    if (selectedText.length > 0) {
      showButton(e.pageX, e.pageY);
    } else {
      removeUI();
    }
  }, 10);
});

document.addEventListener('mousedown', (e) => {
  if (!e.target.closest('#gemini-translate-btn') && !e.target.closest('#gemini-translate-result-container')) {
    removeUI();
  }
});

function showButton(x, y) {
  removeUI();
  translateBtn = document.createElement('button');
  translateBtn.id = 'gemini-translate-btn';
  translateBtn.textContent = '번역';
  translateBtn.style.left = `${x + 10}px`;
  translateBtn.style.top = `${y + 10}px`;
  
  translateBtn.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    e.preventDefault();
    translateText(x, y);
  });

  document.body.appendChild(translateBtn);
}

function showResult(text, x, y, title = '') {
  removeUI();
  
  resultBox = document.createElement('div');
  resultBox.id = 'gemini-translate-result-container';
  resultBox.style.left = `${x + 10}px`;
  resultBox.style.top = `${y + 10}px`;

  if (title) {
    const header = document.createElement('div');
    header.id = 'gemini-translate-result-header';
    
    const titleSpan = document.createElement('span');
    titleSpan.textContent = title;
    header.appendChild(titleSpan);

    const copyBtn = document.createElement('button');
    copyBtn.id = 'gemini-translate-copy-btn';
    copyBtn.textContent = '복사';
    copyBtn.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      navigator.clipboard.writeText(text).then(() => {
        copyBtn.textContent = '완료';
        setTimeout(() => { copyBtn.textContent = '복사'; }, 1500);
      });
    });
    header.appendChild(copyBtn);

    resultBox.appendChild(header);
  }

  const content = document.createElement('div');
  content.id = 'gemini-translate-result-content';
  content.textContent = text;
  resultBox.appendChild(content);

  document.body.appendChild(resultBox);
}

function removeUI() {
  if (translateBtn) { translateBtn.remove(); translateBtn = null; }
  if (resultBox) { resultBox.remove(); resultBox = null; }
}

function translateText(x, y) {
  translateBtn.textContent = '번역 중...';
  chrome.runtime.sendMessage({ action: "translate", text: selectedText }, (response) => {
    if (chrome.runtime.lastError) {
      showResult(`오류: ${chrome.runtime.lastError.message}`, x, y);
      return;
    }

    if (response.error) {
      showResult(`오류: ${response.error}`, x, y);
    } else {
      const modelNames = {
        'gemini-2.5-pro': 'Gemini 2.5 Pro',
        'gemini-3.1-pro': 'Gemini 3.1 Pro',
        'gemini-3.1-flash-lite': 'Gemini 3.1 Flash Lite',
        'gemini-3.5-flash': 'Gemini 3.5 Flash'
      };
      
      const prettyModelName = modelNames[response.model] || response.model;
      const title = `${prettyModelName} ${response.lang} 번역 결과`;
      
      showResult(response.result, x, y, title);
    }
  });
}