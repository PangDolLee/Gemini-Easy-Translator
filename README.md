# Gemini Easy Translator (Chrome Extension)

A lightweight and powerful Chrome Extension that translates text on any webpage using the Google Gemini API. It provides a seamless translation experience through text selection (drag), right-click context menus, and a dedicated popup interface.

## Features

* **Drag to Translate:** Simply highlight text on any webpage, and a translation button will appear. The result is displayed in a neat tooltip with a one-click copy button.
* **Context Menu Translation:** Right-click highlighted text to translate it instantly, bypassing restrictions on secure pages or PDF viewers.
* **Popup Direct Translation:** A built-in popup interface for manual text input and translation without leaving your current tab.
* **Selectable AI Models:** Choose from the latest Gemini models to balance speed and quality:
  * Gemini 2.5 Pro / 2.5 Flash / **2.5 Flash Lite(Recommended)**
  * Gemini 3.1 Pro / **3.1 Flash Lite(Recommended)**
  * Gemini 3.5 Flash
* **Custom Glossary:** Enforce specific translations for certain words. You can add them manually or upload a `.csv` file.
* **Custom Prompts:** Add custom instructions (e.g., "Translate into a casual tone") to tailor the translation output.

## Prerequisites

To use this extension, you need a valid **Gemini API Key**. 
You can get one for free from [Google AI Studio](https://aistudio.google.com/).

If you frequently use the translation feature, it is recommended to set up a paid API plan.
When using the free plan, there may be token limitations, which could cause issues when using the translation function.

## Installation

Since this extension is not published on the Chrome Web Store, you need to load it manually via Developer Mode.

1. Download or clone this repository to your local machine.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** by toggling the switch in the top right corner.
4. Click the **Load unpacked** button.
5. Select the directory containing the extension files.

## Configuration & Usage

1. Click the extension icon in your Chrome toolbar.
2. Enter your **Gemini API Key** in the settings panel.
3. Select your preferred **Model** and **Target Language**.
4. (Optional) Add a custom prompt or configure your personal dictionary.
5. **Auto-save:** All settings are saved automatically as you type or change options.

### Glossary CSV Format
If you want to bulk-upload a custom dictionary, use a `.csv` file with the following format (no headers required):
```text
OriginalWord,TranslatedWord
Apple,사과
Banana,바나나
