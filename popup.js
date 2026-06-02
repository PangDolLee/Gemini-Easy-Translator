document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('apiKey');
  const modelSelect = document.getElementById('modelSelect');
  const targetLangSelect = document.getElementById('targetLang');
  const customPromptInput = document.getElementById('customPrompt');
  const statusDiv = document.getElementById('status');
  
  // 사용자 사전 관련 요소
  const dictKeyInput = document.getElementById('dictKey');
  const dictValInput = document.getElementById('dictVal');
  const addDictBtn = document.getElementById('addDictBtn');
  const dictList = document.getElementById('dictList');
  let userDictionary = [];

  // 데이터 불러오기
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

  // 일반 설정 저장
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

  // --- 사용자 사전 로직 ---
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

    // 삭제 버튼 이벤트 연결
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
      // 중복 체크 및 추가
      const existingIndex = userDictionary.findIndex(item => item.key === key);
      if (existingIndex > -1) {
        userDictionary[existingIndex].val = val; // 기존 단어 덮어쓰기
      } else {
        userDictionary.push({ key, val });
      }
      dictKeyInput.value = '';
      dictValInput.value = '';
      renderDictList();
      saveDictionary();
    }
  });

  // --- 직접 입력 번역 로직 ---
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