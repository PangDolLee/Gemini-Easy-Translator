module.exports = [
  {
    ignores: ['node_modules/**']
  },
  {
    files: ['background.js', 'content.js', 'constants.js', 'utils.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'script',
      globals: {
        chrome: 'readonly',
        self: 'readonly',
        module: 'readonly',
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        AbortController: 'readonly',
        FileReader: 'readonly',
        confirm: 'readonly',
        GeminiTranslatorConstants: 'readonly',
        GeminiTranslatorUtils: 'readonly',
        MODEL_NAMES: 'readonly',
        LANGS: 'readonly',
        LONG_TEXT_THRESHOLD: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-undef': 'error'
    }
  },
  {
    files: ['popup.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'script',
      globals: {
        chrome: 'readonly',
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        navigator: 'readonly',
        GeminiTranslatorConstants: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-undef': 'error'
    }
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'readonly',
        __dirname: 'readonly'
      }
    }
  }
];
