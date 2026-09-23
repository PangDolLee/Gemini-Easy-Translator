let shadowHost = null;
let shadowRoot = null;
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

const { MODEL_NAMES, LANGS, PRESET_LABELS, LONG_TEXT_THRESHOLD } = GeminiTranslatorConstants;

// 번역 결과 HTML에서 눈에 보이는 내용이 없는 태그를 제거한다. 정규식으로 태그
// 이름을 나열해 지우는 방식은 새로운 중첩 패턴(예: <div><h2></h2></div>)마다
// 다시 깨지므로, 실제 DOM으로 파싱해 "내용이 없는 요소"를 구조와 무관하게
// 정확히 판별한다.
// - SELF_MEANINGFUL_TAGS: 해당 태그 자신은 비어 있어도 지우지 않는다(img 등).
// - br은 단순 줄바꿈일 뿐 "내용"이 아니므로, br만 들어있는 래퍼(예: <li><br></li>)
//   는 비어 있는 것으로 간주해 지운다. 다만 br 요소 자체는 항상 보존한다.
const SELF_MEANINGFUL_TAGS = 'img,br,hr,svg,video,audio,iframe,canvas,input,source';
const CONTENT_TAGS = 'img,hr,svg,video,audio,iframe,canvas,input,source';
// 일반 공백이 아니라서 String.trim()으로는 지워지지 않는 "보이지 않는" 유니코드
// 문자(zero-width space 등). 모델이 이런 문자만 채운 요소를 내보내면 실제로는
// 비어 보이는데도 "내용이 있다"고 잘못 판단해 여백만 차지하는 문제가 생긴다.
const INVISIBLE_CHARS_RE = /[​‌‍⁠﻿­]/g;

function pruneEmptyElements(html) {
  if (!html) return html;
  const container = document.createElement('div');
  container.innerHTML = html;

  function visibleText(el) {
    return el.textContent.replace(INVISIBLE_CHARS_RE, '').trim();
  }

  function isRemovable(el) {
    if (el.matches(SELF_MEANINGFUL_TAGS)) return false;
    if (visibleText(el) !== '') return false;
    return !el.querySelector(CONTENT_TAGS);
  }

  let removedAny = true;
  while (removedAny) {
    removedAny = false;
    container.querySelectorAll('*').forEach((el) => {
      if (isRemovable(el)) {
        el.remove();
        removedAny = true;
      }
    });
  }

  // 맨 앞/맨 뒤에 남은 순수 공백 텍스트나 단독 <br>도 정리한다(중간의 <br>은
  // 원문 서식으로 간주해 그대로 둔다).
  function isEdgeTrimmable(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent.replace(INVISIBLE_CHARS_RE, '').trim() === '';
    }
    return node.nodeType === Node.ELEMENT_NODE && node.tagName === 'BR';
  }
  while (container.firstChild && isEdgeTrimmable(container.firstChild)) {
    container.removeChild(container.firstChild);
  }
  while (container.lastChild && isEdgeTrimmable(container.lastChild)) {
    container.removeChild(container.lastChild);
  }

  return container.innerHTML;
}

// [수정] Shadow DOM 초기화 및 스타일 격리
function initShadowDOM() {
  if (!shadowHost) {
    shadowHost = document.createElement('div');
    shadowHost.id = 'gemini-translate-extension-host';
    shadowHost.style.position = 'absolute';
    shadowHost.style.zIndex = '2147483647';
    shadowHost.style.top = '0';
    shadowHost.style.left = '0';
    document.body.appendChild(shadowHost);
    
    shadowRoot = shadowHost.attachShadow({ mode: 'open' });
    
    const style = document.createElement('style');
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700&family=Noto+Sans:wght@400;500;600;700&display=swap');
      #gemini-translate-btn-wrapper, #gemini-translate-result-container {
        --bg-color: #f4f4f7; --panel-color: #ffffff; --text-main: #1a1a1b; --text-sub: #65676b;
        --border-color: #e4e6eb; --btn-bg: #e0f2fe; --btn-hover: #bae6fd; --btn-text: #0369a1;
      }
      #gemini-translate-btn-wrapper[data-theme="dark"], #gemini-translate-result-container[data-theme="dark"] {
        --bg-color: #1a1a1b; --panel-color: #272729; --text-main: #d7dadc; --text-sub: #a8aaab;
        --border-color: #343536; --btn-bg: #0284c7; --btn-hover: #0369a1; --btn-text: #f0f9ff;
      }
      #gemini-translate-btn-wrapper {
        all: initial; position: absolute; z-index: 9147483647; display: flex; align-items: center; gap: 6px;
        background-color: var(--panel-color); border: 1px solid var(--border-color); border-radius: 8px;
        padding: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); box-sizing: border-box;
      }
      #gemini-translate-custom-select {
        all: initial; position: relative; font-family: "Noto Sans KR", "Noto Sans", -apple-system, sans-serif; box-sizing: border-box;
      }
      #gemini-translate-select-trigger {
        all: initial; display: flex; justify-content: space-between; align-items: center; font-family: inherit; font-size: 13px;
        font-weight: 500; color: var(--text-main); background-color: var(--bg-color); border: 1px solid var(--border-color);
        border-radius: 4px; padding: 4px 8px; cursor: pointer; line-height: 1.2; box-sizing: border-box; min-width: 72px;
        transition: background-color 0.2s, border-color 0.2s; white-space: nowrap; /* 줄바꿈 방지 추가 */
      }
      #gemini-translate-select-trigger:hover { background-color: var(--border-color); }
      #gemini-translate-select-arrow {
        all: initial; display: inline-block; width: 12px; height: 12px; margin-left: 6px;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2365676b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
        background-repeat: no-repeat; background-position: center; background-size: contain;
      }
      #gemini-translate-btn-wrapper[data-theme="dark"] #gemini-translate-select-arrow {
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23a8aaab' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
      }
      #gemini-translate-options-list {
        all: initial; display: none; position: absolute; top: calc(100% + 6px); left: 0; width: 100%; min-width: 80px;
        background-color: var(--panel-color); border: 1px solid var(--border-color); border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 9147483648; margin: 0; padding: 4px 0; list-style: none; box-sizing: border-box;
      }
      #gemini-translate-options-list li {
        all: initial; display: block; font-family: "Noto Sans KR", "Noto Sans", -apple-system, sans-serif; font-size: 13px;
        color: var(--text-main); padding: 8px 12px; cursor: pointer; line-height: 1.2; box-sizing: border-box; transition: background-color 0.2s; white-space: nowrap; /* 줄바꿈 방지 추가 */
      }
      #gemini-translate-options-list li:hover { background-color: var(--bg-color); }
      #gemini-translate-options-list li.selected { color: var(--status-color); font-weight: 600; background-color: var(--bg-color); }
      #gemini-translate-btn-inner {
        all: initial; display: inline-flex; align-items: center; justify-content: center; white-space: nowrap; 
        background-color: var(--btn-bg); color: var(--btn-text); border: 1px solid rgba(0,0,0,0.05); border-radius: 4px;
        padding: 4px 12px; cursor: pointer; font-family: "Noto Sans KR", "Noto Sans", -apple-system, sans-serif; font-size: 13px;
        font-weight: 600; transition: background-color 0.2s, color 0.2s; line-height: 1.2; box-sizing: border-box;
      }
      #gemini-translate-btn-inner:hover { background-color: var(--btn-hover); }
      #gemini-translate-result-container {
        all: initial; position: absolute; z-index: 9147483647; background-color: var(--panel-color); border: 1px solid var(--border-color);
        border-radius: 8px; width: 380px; font-family: "Noto Sans KR", "Noto Sans", -apple-system, sans-serif;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15); overflow: hidden; box-sizing: border-box; display: flex; flex-direction: column;
      }
      #gemini-translate-result-header {
        background-color: var(--bg-color); color: var(--text-sub); padding: 8px 12px; font-size: 12px; font-weight: 600;
        border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: flex-start;
        line-height: 1.2; box-sizing: border-box; cursor: move; user-select: none; flex-shrink: 0;
      }
      #gemini-translate-result-header span { font-family: inherit; color: inherit; font-size: inherit; font-weight: inherit; margin: 0; padding: 0; display: block; }
      #gemini-translate-result-header .preset-label { font-size: 10px; font-weight: 500; margin-top: 3px; opacity: 0.85; }
      #gemini-translate-result-content {
        padding: 12px 16px; font-size: var(--content-font-size, 14px); line-height: 1.6; color: var(--text-main);
        word-break: break-word; overflow-wrap: anywhere; white-space: normal; /* pre-wrap 제거 및 normal 적용 */
        background-color: var(--panel-color); box-sizing: border-box; flex: 1; overflow-y: auto; overflow-x: hidden;
      }
      /* 번역 결과에 남아있을 수 있는 구식 width 속성이나 예상치 못한 태그가
         박스 밖으로 삐져나오지 않도록, 모든 하위 요소의 폭을 강제로 제한한다. */
      #gemini-translate-result-content * {
        max-width: 100% !important;
        box-sizing: border-box;
      }
      /* h1~h6, blockquote, table 등 어떤 태그가 와도 브라우저 기본 여백(UA
         stylesheet)이 남지 않도록, 직계 자식 전체를 한 번에 리셋한다
         (예: blockquote의 기본 margin: 1em 40px, h2의 기본 margin: 0.83em 0). */
      #gemini-translate-result-content > * {
        margin-top: 0; margin-bottom: 8px;
      }
      /* blockquote 등 안에 중첩된 p/li도 함께 리셋(직계 자식 규칙은 최상위에만 적용). */
      #gemini-translate-result-content p,
      #gemini-translate-result-content li {
        margin-top: 0; margin-bottom: 8px;
      }
      #gemini-translate-result-content blockquote {
        padding-left: 10px;
        border-left: 3px solid var(--border-color);
      }
      #gemini-translate-result-content ul,
      #gemini-translate-result-content ol {
        padding-left: 20px;
      }
      #gemini-translate-result-content table {
        max-width: 100%;
        border-collapse: collapse;
      }
      #gemini-translate-result-content > *:first-child { margin-top: 0 !important; }
      #gemini-translate-result-content > *:last-child {
        margin-bottom: 0 !important;
      }
      #gemini-translate-result-content img {
        max-width: 100%;
        height: auto;
      }
      #gemini-translate-result-content img.emoji,
      #gemini-translate-result-content img[src*="emoji"],
      #gemini-translate-result-content img[alt^="twemoji"] {
        height: 1.2em !important;
        width: 1.2em !important;
        vertical-align: -0.2em !important;
        margin: 0 0.1em !important;
        display: inline-block !important;
      }
      #gemini-translate-copy-btn, #gemini-translate-close-btn {
        all: initial; background-color: var(--panel-color); color: var(--text-sub); border: 1px solid var(--border-color); border-radius: 4px;
        padding: 4px 8px; font-size: 11px; font-weight: 600; cursor: pointer; font-family: "Noto Sans KR", "Noto Sans", sans-serif;
        line-height: 1; display: inline-block; box-sizing: border-box; transition: background-color 0.2s, color 0.2s;
      }
      #gemini-translate-copy-btn:hover { background-color: var(--bg-color); }
      #gemini-translate-close-btn:hover { background-color: #fef2f2; color: #ef4444; border-color: #fca5a5; }
      #gemini-translate-resize-handle {
        all: initial; position: absolute; right: 2px; bottom: 2px; width: 10px; height: 10px; cursor: se-resize;
        z-index: 9147483647; border-right: 2px solid var(--text-sub); border-bottom: 2px solid var(--text-sub);
        opacity: 0.3; box-sizing: border-box; transition: opacity 0.2s;
      }
      #gemini-translate-resize-handle:hover { opacity: 0.8; }
    `;
    shadowRoot.appendChild(style);
  }
}

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
      const prettyModelName = MODEL_NAMES[request.model] || request.model;
      const title = `${prettyModelName} ${request.lang} 번역 결과`;
      const presetLabel = request.preset && request.preset !== 'none' ? PRESET_LABELS[request.preset] : null;
      showResult(pruneEmptyElements(request.result), lastMouseX, lastMouseY, title, true, presetLabel);
    }
  }
});

// [수정] Shadow DOM 요소를 타겟으로 하는 e.composedPath() 사용
document.addEventListener('mousedown', (e) => {
  const path = e.composedPath();
  const inWrapper = translateWrapper && path.includes(translateWrapper);
  const inResult = resultBox && path.includes(resultBox);

  if (inWrapper || inResult) {
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
  
  const path = e.composedPath();
  if ((translateWrapper && path.includes(translateWrapper)) || (resultBox && path.includes(resultBox))) return;
  
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

      let tempHTML = div.innerHTML;
      tempHTML = tempHTML.replace(/(<(?!\/)[^>]+>)+(?:\s|&nbsp;|<br\s*\/?>)*(<\/[^>]+>)+$/gi, '');
      selectedHTML = tempHTML.replace(/(?:<br\s*\/?>|\n|\r|\s|&nbsp;)+$/gi, '').trim();

      showButton(e.pageX, e.pageY);
    } else {
      if (translateWrapper) { translateWrapper.remove(); translateWrapper = null; }
    }
  }, 10);
});

function showButton(x, y) {
  initShadowDOM();
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
  
  const langs = LANGS;
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

  // [수정] composedPath를 이용하여 Shadow DOM 내부 영역 확인
  document.addEventListener('mousedown', function closeDropdown(e) {
    if (customSelect && !e.composedPath().includes(customSelect)) {
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
  
  // [수정] document.body 대신 Shadow Root에 부착
  shadowRoot.appendChild(translateWrapper);
}

function showResult(textOrHTML, x, y, title = '', isHTML = false, presetLabel = null) {
  initShadowDOM();
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
    
    const titleWrap = document.createElement('div');
    const titleSpan = document.createElement('span');
    titleSpan.textContent = title;
    titleWrap.appendChild(titleSpan);
    if (presetLabel) {
      const presetSpan = document.createElement('span');
      presetSpan.className = 'preset-label';
      presetSpan.textContent = `${presetLabel} 프리셋 적용`;
      titleWrap.appendChild(presetSpan);
    }
    header.appendChild(titleWrap);

    const btnWrapper = document.createElement('div');
    btnWrapper.style.display = 'flex';
    btnWrapper.style.gap = '4px';

    const copyBtn = document.createElement('button');
    copyBtn.id = 'gemini-translate-copy-btn';
    copyBtn.textContent = '복사';
    copyBtn.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = textOrHTML;
      navigator.clipboard.writeText(tempDiv.textContent || tempDiv.innerText || textOrHTML).then(() => {
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
      if (e.target.closest('button') || e.composedPath().includes(copyBtn) || e.composedPath().includes(closeBtn)) return; 
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

  // [수정] document.body 대신 Shadow Root에 부착
  shadowRoot.appendChild(resultBox);
}

function translateText(x, y, btnElement) {
  let useNewTab = false;
  let newWin = null;

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
              :root { ${cssVars} }
              body {
                font-family: "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", -apple-system, sans-serif;
                background-color: var(--bg-color); color: var(--text-main); margin: 0; padding: 40px 20px;
                display: flex; justify-content: center;
              }
              .container {
                width: 100%; max-width: 800px; min-width: 0; background-color: var(--panel-color);
                border: 1px solid var(--border-color); border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                padding: 30px 40px; box-sizing: border-box; overflow-wrap: anywhere; overflow-x: hidden;
              }
              .loading { color: var(--status-color); font-weight: 600; font-size: 16px; text-align: center; padding: 40px 0; }
              .header { border-bottom: 2px solid var(--border-color); padding-bottom: 16px; margin-bottom: 24px; font-size: 20px; font-weight: bold; word-break: break-word; overflow-wrap: anywhere; }
              .header-sub { font-size: 13px; font-weight: 500; color: var(--text-sub); margin-top: 4px; }
              .section-title { font-size: 13px; font-weight: bold; color: var(--text-sub); margin-bottom: 8px; text-transform: uppercase; outline: none; }
              .content-box {
                font-size: ${currentFontSize}; line-height: 1.6; white-space: pre-wrap; margin-bottom: 30px;
                word-break: break-word; overflow-wrap: anywhere; max-width: 100%; box-sizing: border-box;
              }
              /* 번역 결과에 남아있을 수 있는 구식 width 속성이나 예상치 못한 태그가
                 박스 밖으로 삐져나오지 않도록, 모든 하위 요소의 폭을 강제로 제한한다. */
              .content-box * {
                max-width: 100% !important;
                box-sizing: border-box;
              }
              .content-box img { height: auto; }
              .content-box table { display: block; overflow-x: auto; border-collapse: collapse; }
              .content-box pre { white-space: pre-wrap; overflow-wrap: anywhere; }
              .content-box blockquote, .content-box figure, .content-box dl, .content-box dd {
                margin: 0 0 8px 0;
              }
              .content-box blockquote { padding-left: 10px; border-left: 3px solid var(--border-color); }
              .content-box ul, .content-box ol { padding-left: 20px; }
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
        // Google Fonts @import 등 외부 리소스가 없으므로 여기서 즉시 스트림을 닫아
        // 탭의 로딩 상태(스피너)가 정상적으로 종료되도록 한다.
        newWin.document.close();
      }
      if (translateWrapper) { translateWrapper.remove(); translateWrapper = null; }
    } else {
      if (btnElement) btnElement.textContent = '번역 중...';
    }
  } else {
    if (btnElement) btnElement.textContent = '번역 중...';
  }

  chrome.runtime.sendMessage({ action: "translate", text: selectedHTML, targetLang: currentTargetLang }, (response) => {
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
      const prettyModelName = MODEL_NAMES[response.model] || response.model;
      const title = `${prettyModelName} ${response.lang} 번역 결과`;
      // 프리셋이 적용된 경우 제목과 별도 줄에 작게 표시한다
      // (설정 없음(기본)은 별도 표시 없이 기본값으로 취급).
      const presetLabel = response.preset && response.preset !== 'none' ? PRESET_LABELS[response.preset] : null;
      const cleanedResult = pruneEmptyElements(response.result);

      if (useNewTab && newWin) {
        const headerSub = presetLabel ? `<div class="header-sub">${presetLabel} 프리셋 적용</div>` : '';
        newWin.document.title = "Gemini 번역 결과";
        newWin.document.getElementById('main-container').innerHTML = `
          <div class="header">${title}${headerSub}</div>
          <details>
            <summary class="section-title">원문 보기 (클릭하여 펼치기)</summary>
            <div class="content-box original">${selectedHTML}</div>
          </details>
          <div class="section-title">번역 결과</div>
          <div class="content-box" style="margin-bottom: 0;">${cleanedResult}</div>
        `;
      } else {
        showResult(cleanedResult, x, y, title, true, presetLabel);
      }
    }
  });
}