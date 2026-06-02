let translateWrapper = null;
let resultBox = null;
let selectedText = '';
let lastMouseX = 0;
let lastMouseY = 0;
let currentTheme = 'light';
let currentTargetLang = '한국어';

const modelNames = {
  'gemini-2.5-pro': 'Gemini 2.5 Pro',
  'gemini-3.1-pro': 'Gemini 3.1 Pro',
  'gemini-2.5-flash-lite': 'Gemini 2.5 Flash Lite',
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
  'gemini-3.1-flash-lite': 'Gemini 3.1 Flash Lite',
  'gemini-3.5-flash': 'Gemini 3.5 Flash'
};

chrome.storage.local.get(['themeSelect', 'targetLang'], (data) => {
  if (data.themeSelect) currentTheme = data.themeSelect;
  if (data.targetLang) currentTargetLang = data.targetLang;
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    if (changes.themeSelect) {
      currentTheme = changes.themeSelect.newValue;
      if (translateWrapper) translateWrapper.setAttribute('data-theme', currentTheme);
      if (resultBox) resultBox.setAttribute('data-theme', currentTheme);
    }
    if (changes.targetLang) {
      currentTargetLang = changes.targetLang.newValue;
    }
  }
});

document.addEventListener('contextmenu', (e) => {
  lastMouseX = e.pageX;
  lastMouseY = e.pageY;
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "showLoading") {
    showResult('번역 중...', lastMouseX, lastMouseY);
  } else if (request.action === "showResult") {
    if (request.error) {
      showResult(`오류: ${request.error}`, lastMouseX, lastMouseY);
    } else {
      const prettyModelName = modelNames[request.model] || request.model;
      const title = `${prettyModelName} ${request.lang} 번역 결과`;
      showResult(request.result, lastMouseX, lastMouseY, title);
    }
  }
});

document.addEventListener('mouseup', (e) => {
  if (e.target.closest('#gemini-translate-btn-wrapper') || e.target.closest('#gemini-translate-result-container')) return;
  setTimeout(() => {
    selectedText = window.getSelection().toString().trim();
    if (selectedText.length > 0) {
      showButton(e.pageX, e.pageY);
    } else {
      if (translateWrapper) { translateWrapper.remove(); translateWrapper = null; }
    }
  }, 10);
});

document.addEventListener('mousedown', (e) => {
  if (!e.target.closest('#gemini-translate-btn-wrapper') && !e.target.closest('#gemini-translate-result-container')) {
    if (translateWrapper) { translateWrapper.remove(); translateWrapper = null; }
  }
});

function showButton(x, y) {
  if (translateWrapper) translateWrapper.remove();
  
  translateWrapper = document.createElement('div');
  translateWrapper.id = 'gemini-translate-btn-wrapper';
  translateWrapper.setAttribute('data-theme', currentTheme);
  translateWrapper.style.left = `${x + 10}px`;
  translateWrapper.style.top = `${y + 10}px`;
  
  // 언어 선택 셀렉트 박스 생성
  const langSelect = document.createElement('select');
  langSelect.id = 'gemini-translate-lang-select';
  const langs = ['한국어', '영어', '일본어', '중국어'];
  langs.forEach(lang => {
    const opt = document.createElement('option');
    opt.value = lang;
    opt.textContent = lang;
    if (lang === currentTargetLang) opt.selected = true;
    langSelect.appendChild(opt);
  });

  langSelect.addEventListener('change', (e) => {
    currentTargetLang = e.target.value;
    chrome.storage.local.set({ targetLang: currentTargetLang });
  });

  // 번역 버튼 생성
  const translateBtnInner = document.createElement('button');
  translateBtnInner.id = 'gemini-translate-btn-inner';
  translateBtnInner.textContent = '번역';
  
  translateBtnInner.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    e.preventDefault();
    translateText(x, y, translateBtnInner);
  });

  translateWrapper.appendChild(langSelect);
  translateWrapper.appendChild(translateBtnInner);
  document.body.appendChild(translateWrapper);
}

function showResult(text, x, y, title = '') {
  if (resultBox) resultBox.remove(); 
  
  resultBox = document.createElement('div');
  resultBox.id = 'gemini-translate-result-container';
  resultBox.setAttribute('data-theme', currentTheme);
  resultBox.style.left = `${x + 10}px`;
  resultBox.style.top = `${y + 10}px`;

  if (title) {
    const header = document.createElement('div');
    header.id = 'gemini-translate-result-header';
    
    const titleSpan = document.createElement('span');
    titleSpan.textContent = title;
    header.appendChild(titleSpan);

    const btnWrapper = document.createElement('div');
    btnWrapper.style.display = 'flex';
    btnWrapper.style.gap = '4px';

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
    btnWrapper.appendChild(copyBtn);

    const closeBtn = document.createElement('button');
    closeBtn.id = 'gemini-translate-close-btn';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (resultBox) { resultBox.remove(); resultBox = null; }
    });
    btnWrapper.appendChild(closeBtn);

    header.appendChild(btnWrapper);
    resultBox.appendChild(header);

    let isDragging = false;
    let dragStartX, dragStartY, initialLeft, initialTop;

    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return; 
      e.preventDefault();
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      initialLeft = parseInt(resultBox.style.left, 10) || 0;
      initialTop = parseInt(resultBox.style.top, 10) || 0;

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    function onMouseMove(e) {
      if (!isDragging) return;
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      resultBox.style.left = `${initialLeft + dx}px`;
      resultBox.style.top = `${initialTop + dy}px`;
    }

    function onMouseUp() {
      isDragging = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }
  }

  const content = document.createElement('div');
  content.id = 'gemini-translate-result-content';
  content.textContent = text;
  resultBox.appendChild(content);

  const resizeHandle = document.createElement('div');
  resizeHandle.id = 'gemini-translate-resize-handle';
  resultBox.appendChild(resizeHandle);

  let isResizing = false;
  let resizeStartWidth, resizeStartHeight, resizeStartX, resizeStartY;

  resizeHandle.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    e.preventDefault();
    isResizing = true;
    resizeStartX = e.clientX;
    resizeStartY = e.clientY;
    resizeStartWidth = resultBox.offsetWidth;
    resizeStartHeight = resultBox.offsetHeight;

    document.addEventListener('mousemove', onResizeMouseMove);
    document.addEventListener('mouseup', onResizeMouseUp);
  });

  function onResizeMouseMove(e) {
    if (!isResizing) return;
    const dw = e.clientX - resizeStartX;
    const dh = e.clientY - resizeStartY;
    
    const targetWidth = Math.max(240, resizeStartWidth + dw);
    const targetHeight = Math.max(120, resizeStartHeight + dh);

    resultBox.style.setProperty('width', `${targetWidth}px`, 'important');
    resultBox.style.setProperty('height', `${targetHeight}px`, 'important');
  }

  function onResizeMouseUp() {
    isResizing = false;
    document.removeEventListener('mousemove', onResizeMouseMove);
    document.removeEventListener('mouseup', onResizeMouseUp);
  }

  document.body.appendChild(resultBox);
}

function translateText(x, y, btnElement) {
  let useNewTab = false;
  let newWin = null;
  const LONG_TEXT_THRESHOLD = 300; 

  if (selectedText.length > LONG_TEXT_THRESHOLD) {
    useNewTab = confirm("선택한 텍스트의 양이 많습니다. 가독성을 위해 번역 결과를 새로운 탭에서 확인하시겠습니까?");
    if (useNewTab) {
      newWin = window.open("", "_blank");
      if (newWin) {
        const isDark = currentTheme === 'dark';
        const cssVars = isDark ? `
          --bg-color: #1a1a1b; --panel-color: #272729; --text-main: #d7dadc; --text-sub: #a8aaab;
          --border-color: #343536; --status-color: #4da3ff;
        ` : `
          --bg-color: #f4f4f7; --panel-color: #ffffff; --text-main: #1a1a1b; --text-sub: #65676b;
          --border-color: #e4e6eb; --status-color: #007bff;
        `;

        newWin.document.write(`
          <html>
          <head>
            <title>번역 진행 중...</title>
            <meta charset="utf-8">
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap');
              :root { ${cssVars} }
              body { font-family: 'Noto Sans KR', -apple-system, sans-serif; background-color: var(--bg-color); color: var(--text-main); margin: 0; padding: 40px 20px; display: flex; justify-content: center; }
              .container { width: 100%; max-width: 800px; background-color: var(--panel-color); border: 1px solid var(--border-color); border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); padding: 30px 40px; box-sizing: border-box; }
              .loading { color: var(--status-color); font-weight: 600; font-size: 16px; text-align: center; padding: 40px 0; }
              .header { border-bottom: 2px solid var(--border-color); padding-bottom: 16px; margin-bottom: 24px; font-size: 20px; font-weight: bold; word-break: break-word; overflow-wrap: break-word; }
              .section-title { font-size: 13px; font-weight: bold; color: var(--text-sub); margin-bottom: 8px; text-transform: uppercase; outline: none; }
              .content-box { font-size: 15px; line-height: 1.6; white-space: pre-wrap; margin-bottom: 30px; word-break: break-word; overflow-wrap: break-word; }
              .original { color: var(--text-sub); border-left: 4px solid var(--border-color); padding-left: 16px; margin-left: 4px; margin-bottom: 0; }
              details { margin-bottom: 30px; }
              details summary { cursor: pointer; user-select: none; }
              details[open] summary { margin-bottom: 12px; }
            </style>
          </head>
          <body>
            <div class="container" id="main-container">
              <div class="loading">번역 중... 잠시만 기다려주세요.</div>
            </div>
          </body>
          </html>
        `);
      }
      if (translateWrapper) { translateWrapper.remove(); translateWrapper = null; }
    } else {
      if (btnElement) btnElement.textContent = '번역 중...';
    }
  } else {
    if (btnElement) btnElement.textContent = '번역 중...';
  }

  // targetLang을 런타임 메시지에 포함시켜 전송
  chrome.runtime.sendMessage({ action: "translate", text: selectedText, targetLang: currentTargetLang }, (response) => {
    if (chrome.runtime.lastError) {
      if (useNewTab && newWin) {
        newWin.document.getElementById('main-container').innerHTML = `<div style="color:#ff4d4f; font-weight:bold; text-align:center; padding:40px 0;">오류: ${chrome.runtime.lastError.message}</div>`;
      } else {
        showResult(`오류: ${chrome.runtime.lastError.message}`, x, y);
      }
      return;
    }

    if (response.error) {
      if (useNewTab && newWin) {
        newWin.document.getElementById('main-container').innerHTML = `<div style="color:#ff4d4f; font-weight:bold; text-align:center; padding:40px 0;">오류: ${response.error}</div>`;
      } else {
        showResult(`오류: ${response.error}`, x, y);
      }
    } else {
      const prettyModelName = modelNames[response.model] || response.model;
      const title = `${prettyModelName} ${response.lang} 번역 결과`;
      
      if (useNewTab && newWin) {
        newWin.document.title = "Gemini 번역 결과";
        newWin.document.getElementById('main-container').innerHTML = `
          <div class="header">${title}</div>
          <details>
            <summary class="section-title">원문 보기 (클릭하여 펼치기)</summary>
            <div class="content-box original">${selectedText}</div>
          </details>
          <div class="section-title">번역 결과</div>
          <div class="content-box" style="margin-bottom: 0;">${response.result}</div>
        `;
      } else {
        showResult(response.result, x, y, title);
      }
    }
  });
}