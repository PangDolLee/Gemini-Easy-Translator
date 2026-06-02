document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('apiKey');
  const modelSelect = document.getElementById('modelSelect');
  const targetLangSelect = document.getElementById('targetLang');
  const customPromptInput = document.getElementById('customPrompt');
  const statusDiv = document.getElementById('status');
  
  const dictKeyInput = document.getElementById('dictKey');
  const dictValInput = document.getElementById('dictVal');
  const addDictBtn = document.getElementById('addDictBtn');
  const dictList = document.getElementById('dictList');
  
  // CSV 업로드 관련 요소
  const csvFileInput = document.getElementById('csvFileInput');
  const uploadCsvBtn = document.getElementById('uploadCsvBtn');

  let userDictionary = [];

  chrome.storage.local.get(['apiKey', 'modelSelect', 'targetLang', 'customPrompt', 'userDict'], (result) => {
    if (result.apiKey) apiKeyInput.value = result.apiKey;
    if (result.modelSelect) modelSelect.value = result.modelSelect;
    if (result.targetLang) targetLangSelect.value = result.targetLang;
    if (result.customPrompt) customPromptInput.value = result.customPrompt;
    if (result.userDict) {
      userDictionary = result.userDict;
      renderDictList();
    }
  });

  function autoSave() {
    chrome.storage.local.set({ 
      apiKey: apiKeyInput.value.trim(), 
      modelSelect: modelSelect.value, 
      targetLang: targetLangSelect.value, 
      customPrompt: customPromptInput.value.trim() 
    }, () => {
      statusDiv.textContent = '자동 저장됨';
      setTimeout(() => { statusDiv.textContent = ''; }, 1000);
    });
  }

  apiKeyInput.addEventListener('input', autoSave);
  modelSelect.addEventListener('change', autoSave);
  targetLangSelect.addEventListener('change', autoSave);
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

  // CSV 파일 업로드 이벤트
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
        // 쉼표로 분리 (간단한 CSV 파싱)
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
      csvFileInput.value = ''; // 입력 필드 초기화
      statusDiv.textContent = 'CSV 적용 완료';
    };
    reader.onerror = function() {
      statusDiv.textContent = '파일 읽기 오류';
    };
    reader.readAsText(file);
  });

  const translateBtn = document.getElementById('translateBtn');
  const inputText = document.getElementById('inputText');
  const translateResult = document.getElementById('translateResult');
  const copyPopupBtn = document.getElementById('copyPopupBtn');
  let currentTranslatedText = '';

  translateBtn.addEventListener('click', () => {
    const text = inputText.value.trim();
    if (!text) {
      translateResult.textContent = '번역할 텍스트를 입력하세요.';
      copyPopupBtn.style.display = 'none';
      return;
    }
    translateResult.textContent = '번역 중...';
    copyPopupBtn.style.display = 'none';

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
        copyPopupBtn.textContent = '결과 복사하기';
      }
    });
  });

  copyPopupBtn.addEventListener('click', () => {
    if (currentTranslatedText) {
      navigator.clipboard.writeText(currentTranslatedText).then(() => {
        copyPopupBtn.textContent = '복사 완료!';
        setTimeout(() => { copyPopupBtn.textContent = '결과 복사하기'; }, 1500);
      });
    }
  });
});
