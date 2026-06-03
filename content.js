let translateWrapper = null;
let resultBox = null;
let selectedHTML = '';
let selectedText = '';
let lastMouseX = 0;
let lastMouseY = 0;
let currentTheme = 'light';
let currentTargetLang = '한국어';
let currentFontSize = '14px';
let isUIInteraction = false; 

const modelNames = {
  'gemini-2.5-pro': 'Gemini 2.5 Pro',
  'gemini-3.1-pro': 'Gemini 3.1 Pro',
  'gemini-2.5-flash-lite': 'Gemini 2.5 Flash Lite',
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
  'gemini-3.1-flash-lite': 'Gemini 3.1 Flash Lite',
  'gemini-3.5-flash': 'Gemini 3.5 Flash'
};

chrome.storage.local.get(['themeSelect', 'targetLang', 'fontSizeSelect'], (data) => {
  if (data.themeSelect) currentTheme = data.themeSelect;
  if (data.targetLang) currentTargetLang = data.targetLang;
  if (data.fontSizeSelect) currentFontSize = data.fontSizeSelect;
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
    if (changes.fontSizeSelect) {
      currentFontSize = changes.fontSizeSelect.newValue;
      if (resultBox) {
        resultBox.style.setProperty('--content-font-size', currentFontSize);
      }
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
      showResult(request.result, lastMouseX, lastMouseY, title, request.isHTML !== false); 
    }
  } else if (request.action === "triggerContextMenuTranslation") {
    const selection = window.getSelection();
    selectedText = selection.toString().trim();
    
    if (selectedText.length > 0 && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const clonedSelection = range.cloneContents();
      const div = document.createElement('div');
      div.appendChild(clonedSelection);
      selectedHTML = div.innerHTML;

      translateText(lastMouseX, lastMouseY, null);
    }
  }
});

document.addEventListener('mousedown', (e) => {
  if (e.target.closest('#gemini-translate-btn-wrapper') || e.target.closest('#gemini-translate-result-container')) {
    isUIInteraction = true;
  } else {
    isUIInteraction = false;
    if (translateWrapper) { translateWrapper.remove(); translateWrapper = null; }
  }
}, true);

document.addEventListener('mouseup', (e) => {
  if (isUIInteraction) {
    isUIInteraction = false; 
    return;
  }
  
  if (e.target.closest('#gemini-translate-btn-wrapper') || e.target.closest('#gemini-translate-result-container')) return;
  
  setTimeout(() => {
    const activeEl = document.activeElement;
    const isInput = activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable;
    if (isInput) return;

    const selection = window.getSelection();
    selectedText = selection.toString().trim();
    
    if (selectedText.length > 0 && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const clonedSelection = range.cloneContents();
      const div = document.createElement('div');
      div.appendChild(clonedSelection);
      selectedHTML = div.innerHTML;

      showButton(e.pageX, e.pageY);
    } else {
      if (translateWrapper) { translateWrapper.remove(); translateWrapper = null; }
    }
  }, 10);
});

function showButton(x, y) {
  if (translateWrapper) translateWrapper.remove();
  
  translateWrapper = document.createElement('div');
  translateWrapper.id = 'gemini-translate-btn-wrapper';
  translateWrapper.setAttribute('data-theme', currentTheme);
  translateWrapper.style.left = `${x + 10}px`;
  translateWrapper.style.top = `${y + 10}px`;
  
  const customSelect = document.createElement('div');
  customSelect.id = 'gemini-translate-custom-select';

  const selectTrigger = document.createElement('div');
  selectTrigger.id = 'gemini-translate-select-trigger';
  
  const triggerText = document.createTextNode(currentTargetLang);
  selectTrigger.appendChild(triggerText);
  
  const arrowIcon = document.createElement('span');
  arrowIcon.id = 'gemini-translate-select-arrow';
  selectTrigger.appendChild(arrowIcon);

  const optionsList = document.createElement('ul');
  optionsList.id = 'gemini-translate-options-list';
  
  const langs = ['한국어', '영어', '일본어', '중국어'];
  langs.forEach(lang => {
    const li = document.createElement('li');
    li.textContent = lang;
    if (lang === currentTargetLang) li.classList.add('selected');
    
    li.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      
      currentTargetLang = lang;
      chrome.storage.local.set({ targetLang: currentTargetLang });
      
      triggerText.nodeValue = lang;
      optionsList.querySelectorAll('li').forEach(item => item.classList.remove('selected'));
      li.classList.add('selected');
      
      optionsList.style.display = 'none';
    });
    optionsList.appendChild(li);
  });

  selectTrigger.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    e.preventDefault();
    const isVisible = optionsList.style.display === 'block';
    optionsList.style.display = isVisible ? 'none' : 'block';
  });

  document.addEventListener('mousedown', function closeDropdown(e) {
    if (customSelect && !customSelect.contains(e.target)) {
      optionsList.style.display = 'none';
    }
  });

  customSelect.appendChild(selectTrigger);
  customSelect.appendChild(optionsList);

  const translateBtnInner = document.createElement('button');
  translateBtnInner.id = 'gemini-translate-btn-inner';
  translateBtnInner.textContent = '번역';
  
  translateBtnInner.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    e.preventDefault();
    translateText(x, y, translateBtnInner);
  });

  translateWrapper.appendChild(customSelect);
  translateWrapper.appendChild(translateBtnInner);
  document.body.appendChild(translateWrapper);
}

function showResult(textOrHTML, x, y, title = '', isHTML = false) {
  if (resultBox) resultBox.remove(); 
  
  if (translateWrapper) { 
    translateWrapper.remove(); 
    translateWrapper = null; 
  }
  
  resultBox = document.createElement('div');
  resultBox.id = 'gemini-translate-result-container';
  resultBox.setAttribute('data-theme', currentTheme);
  resultBox.style.setProperty('--content-font-size', currentFontSize);
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
      const doc = new DOMParser().parseFromString(textOrHTML, 'text/html');
      const pureText = doc.body.textContent || "";
      
      navigator.clipboard.writeText(pureText).then(() => {
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
  
  if (isHTML) {
    content.innerHTML = textOrHTML;
  } else {
    content.textContent = textOrHTML;
  }
  
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
  const LONG_TEXT_THRESHOLD = 1000; 

  if (selectedText.length > LONG_TEXT_THRESHOLD) {
    const useNewTab = confirm("선택한 텍스트의 양이 많습니다. 가독성을 위해 번역 결과를 새로운 탭에서 확인하시겠습니까?");
    if (useNewTab) {
      chrome.runtime.sendMessage({
        action: "openResultTab",
        payload: {
          text: selectedHTML,
          targetLang: currentTargetLang,
          theme: currentTheme,
          fontSize: currentFontSize
        }
      });
      if (translateWrapper) { translateWrapper.remove(); translateWrapper = null; }
      return; 
    }
  }

  if (btnElement) btnElement.textContent = '번역 중...';
  showResult('번역 중...', x, y);

  chrome.runtime.sendMessage({ action: "translate", text: selectedHTML, targetLang: currentTargetLang }, (response) => {
    if (chrome.runtime.lastError) {
      showResult(`오류: ${chrome.runtime.lastError.message}`, x, y);
      return;
    }

    if (response.error) {
      showResult(`오류: ${response.error}`, x, y);
    } else {
      const prettyModelName = modelNames[response.model] || response.model;
      const title = `${prettyModelName} ${response.lang} 번역 결과`;
      showResult(response.result, x, y, title, true); 
    }
  });
}