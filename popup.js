document.addEventListener('DOMContentLoaded', () => {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });

  const themeSelect = document.getElementById('themeSelect');
  const fontSizeSelect = document.getElementById('fontSizeSelect');
  const apiKeyInput = document.getElementById('apiKey');
  const modelSelect = document.getElementById('modelSelect');
  const targetLangSelect = document.getElementById('targetLang');
  const presetSelect = document.getElementById('presetSelect');
  const customPromptInput = document.getElementById('customPrompt');
  const statusDiv = document.getElementById('status');
  
  const dictKeyInput = document.getElementById('dictKey');
  const dictValInput = document.getElementById('dictVal');
  const addDictBtn = document.getElementById('addDictBtn');
  const dictList = document.getElementById('dictList');
  const csvFileInput = document.getElementById('csvFileInput');
  const uploadCsvBtn = document.getElementById('uploadCsvBtn');

  const historyTitle = document.getElementById('historyTitle');
  const historyList = document.getElementById('historyList');
  const toggleHistoryBtn = document.getElementById('toggleHistoryBtn');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');

  let userDictionary = [];
  let translationHistoryArray = [];

  chrome.storage.local.get(['themeSelect', 'fontSizeSelect', 'apiKey', 'modelSelect', 'targetLang', 'presetSelect', 'customPrompt', 'userDict', 'translationHistory'], (result) => {
    if (result.themeSelect) {
      themeSelect.value = result.themeSelect;
      document.documentElement.setAttribute('data-theme', result.themeSelect);
    }
    if (result.fontSizeSelect) fontSizeSelect.value = result.fontSizeSelect;
    if (result.apiKey) apiKeyInput.value = result.apiKey;
    if (result.modelSelect) modelSelect.value = result.modelSelect;
    if (result.targetLang) targetLangSelect.value = result.targetLang;
    if (result.presetSelect) presetSelect.value = result.presetSelect;
    if (result.customPrompt) customPromptInput.value = result.customPrompt;
    if (result.userDict) {
      userDictionary = result.userDict;
      renderDictList();
    }
    translationHistoryArray = result.translationHistory || [];
    renderHistory(translationHistoryArray);
  });

  function autoSave() {
    const selectedTheme = themeSelect.value;
    document.documentElement.setAttribute('data-theme', selectedTheme);
    chrome.storage.local.set({ 
      themeSelect: selectedTheme,
      fontSizeSelect: fontSizeSelect.value,
      apiKey: apiKeyInput.value.trim(), 
      modelSelect: modelSelect.value, 
      targetLang: targetLangSelect.value,
      presetSelect: presetSelect.value,
      customPrompt: customPromptInput.value.trim() 
    }, () => {
      statusDiv.textContent = '자동 저장됨';
      setTimeout(() => { statusDiv.textContent = ''; }, 1000);
    });
  }

  themeSelect.addEventListener('change', autoSave);
  fontSizeSelect.addEventListener('change', autoSave);
  apiKeyInput.addEventListener('input', autoSave);
  modelSelect.addEventListener('change', autoSave);
  targetLangSelect.addEventListener('change', autoSave);
  presetSelect.addEventListener('change', autoSave);
  customPromptInput.addEventListener('input', autoSave);

  function saveDictionary() {
    chrome.storage.local.set({ userDict: userDictionary }, () => {
      statusDiv.textContent = '사전 저장됨';
      setTimeout(() => { statusDiv.textContent = ''; }, 1000);
    });
  }

  function renderDictList() {
    dictList.innerHTML = '';
    userDictionary.forEach((item, index) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span><b>${item.key}</b> → ${item.val}</span>
        <button class="delete-dict-btn" data-index="${index}">✕</button>
      `;
      dictList.appendChild(li);
    });
    document.querySelectorAll('.delete-dict-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = e.target.getAttribute('data-index');
        userDictionary.splice(idx, 1);
        renderDictList();
        saveDictionary();
      });
    });
  }

  addDictBtn.addEventListener('click', () => {
    const key = dictKeyInput.value.trim();
    const val = dictValInput.value.trim();
    if (key && val) {
      addOrUpdateDictionary(key, val);
      dictKeyInput.value = '';
      dictValInput.value = '';
      renderDictList();
      saveDictionary();
    }
  });

  function addOrUpdateDictionary(key, val) {
    const existingIndex = userDictionary.findIndex(item => item.key === key);
    if (existingIndex > -1) {
      userDictionary[existingIndex].val = val;
    } else {
      userDictionary.push({ key, val });
    }
  }

  uploadCsvBtn.addEventListener('click', () => {
    const file = csvFileInput.files[0];
    if (!file) {
      statusDiv.textContent = '파일을 선택하세요';
      return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
      const text = e.target.result;
      const lines = text.split('\n');
      lines.forEach(line => {
        const parts = line.split(',');
        if (parts.length >= 2) {
          const key = parts[0].trim();
          const val = parts[1].trim();
          if (key && val) {
            addOrUpdateDictionary(key, val);
          }
        }
      });
      renderDictList();
      saveDictionary();
      csvFileInput.value = '';
      statusDiv.textContent = 'CSV 적용 완료';
    };
    reader.readAsText(file);
  });

  const translateBtn = document.getElementById('translateBtn');
  const inputText = document.getElementById('inputText');
  const translateResult = document.getElementById('translateResult');
  const copyPopupBtn = document.getElementById('copyPopupBtn');
  const swapBtn = document.getElementById('swapBtn');
  let currentTranslatedText = '';
  let lastOriginalText = '';

  translateBtn.addEventListener('click', () => {
    const text = inputText.value.trim();
    if (!text) {
      translateResult.textContent = '번역할 텍스트를 입력하세요.';
      copyPopupBtn.style.display = 'none';
      swapBtn.style.display = 'none';
      return;
    }
    lastOriginalText = text;
    translateResult.textContent = '번역 중...';
    copyPopupBtn.style.display = 'none';
    swapBtn.style.display = 'none';
    chrome.runtime.sendMessage({ action: "translate", text: text }, (response) => {
      if (chrome.runtime.lastError) {
        translateResult.textContent = `오류: ${chrome.runtime.lastError.message}`;
        return;
      }
      if (response.error) {
        translateResult.textContent = `오류: ${response.error}`;
      } else {
        currentTranslatedText = response.result;
        translateResult.textContent = currentTranslatedText;
        copyPopupBtn.style.display = 'block';
        swapBtn.style.display = 'block';
      }
    });
  });

  copyPopupBtn.addEventListener('click', () => {
    if (currentTranslatedText) {
      navigator.clipboard.writeText(currentTranslatedText).then(() => {
        copyPopupBtn.textContent = '복사 완료!';
        setTimeout(() => { copyPopupBtn.textContent = '복사하기'; }, 1500);
      });
    }
  });

  swapBtn.addEventListener('click', () => {
    if (!currentTranslatedText) return;
    let originalLang = '영어';
    if (/[가-힣]/.test(lastOriginalText)) {
      originalLang = '한국어';
    } else if (/[ぁ-んァ-ヶ]/.test(lastOriginalText)) {
      originalLang = '일본어';
    } else if (/[一-龥]/.test(lastOriginalText)) {
      originalLang = '중국어';
    }
    inputText.value = currentTranslatedText;
    targetLangSelect.value = originalLang;
    autoSave();
    translateResult.textContent = '역번역 준비 완료. 번역하기를 누르세요.';
    currentTranslatedText = '';
    copyPopupBtn.style.display = 'none';
    swapBtn.style.display = 'none';
  });

  function renderHistory(historyArray) {
    translationHistoryArray = historyArray;
    historyTitle.textContent = `최근 번역 기록 (${historyArray.length})`;
    historyList.innerHTML = '';
    if (!historyArray || historyArray.length === 0) {
      historyList.innerHTML = '<li style="text-align:center; color:var(--text-sub); background:transparent;">기록이 없습니다.</li>';
      return;
    }
    historyArray.forEach((item, index) => {
      const li = document.createElement('li');
      const dateStr = new Date(item.timestamp).toLocaleString('ko-KR', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
      let sourceHtml = '';
      if (item.url && item.url.startsWith('http')) {
        try {
          const urlObj = new URL(item.url);
          sourceHtml = `<a href="${item.url}" target="_blank" title="${item.url}">${urlObj.hostname} ↗</a>`;
        } catch(e) { sourceHtml = `<a href="${item.url}" target="_blank">링크 이동 ↗</a>`; }
      } else { sourceHtml = `<span>${item.url || '직접 입력함'}</span>`; }
      li.innerHTML = `
        <div class="hist-item-header">
          <div class="hist-original">${item.original}</div>
          <button class="delete-history-item-btn" data-index="${index}">✕</button>
        </div>
        <div class="hist-translated">${item.translated}</div>
        <div class="hist-footer">
          <div class="hist-source">${sourceHtml}</div>
          <div class="hist-date">${dateStr}</div>
        </div>
      `;
      historyList.appendChild(li);
    });
    document.querySelectorAll('.delete-history-item-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.getAttribute('data-index'), 10);
        translationHistoryArray.splice(idx, 1);
        chrome.storage.local.set({ translationHistory: translationHistoryArray }, () => { renderHistory(translationHistoryArray); });
      });
    });
  }

  toggleHistoryBtn.addEventListener('click', () => {
    if (historyList.style.display === 'block') {
      historyList.style.display = 'none';
      toggleHistoryBtn.textContent = '펼치기';
    } else {
      historyList.style.display = 'block';
      toggleHistoryBtn.textContent = '접기';
    }
  });

  clearHistoryBtn.addEventListener('click', () => {
    if (confirm("모든 번역 이력이 삭제됩니다. 삭제하시겠습니까?")) {
      chrome.storage.local.set({ translationHistory: [] }, () => {
        renderHistory([]);
        statusDiv.textContent = '기록이 삭제되었습니다';
        setTimeout(() => { statusDiv.textContent = ''; }, 1500);
      });
    }
  });

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.translationHistory) {
      renderHistory(changes.translationHistory.newValue || []);
    }
  });
});

document.addEventListener('DOMContentLoaded', () => {
  try {
    const manifest = chrome.runtime.getManifest();
    const versionContainer = document.getElementById('programVersion');
    if (versionContainer && manifest && manifest.version) {
      versionContainer.textContent = `버전: v${manifest.version}`;
    }
  } catch (error) {
    console.error('버전 정보 로드 실패:', error);
  }
});