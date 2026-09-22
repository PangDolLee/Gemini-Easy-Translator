const test = require('node:test');
const assert = require('node:assert/strict');
const { cleanupTranslatedHtml, stripHtml } = require('../utils.js');

test('cleanupTranslatedHtml strips markdown code fences', () => {
  const input = '```html\n<p>안녕하세요</p>\n```';
  assert.equal(cleanupTranslatedHtml(input), '<p>안녕하세요</p>');
});

test('cleanupTranslatedHtml removes empty trailing p/div tags', () => {
  const input = '<p>본문</p><p></p><div>&nbsp;</div>';
  assert.equal(cleanupTranslatedHtml(input), '<p>본문</p>');
});

test('cleanupTranslatedHtml trims trailing line breaks and whitespace', () => {
  const input = '<p>본문</p><br><br>\n  ';
  assert.equal(cleanupTranslatedHtml(input), '<p>본문</p>');
});

test('cleanupTranslatedHtml returns empty string for falsy input', () => {
  assert.equal(cleanupTranslatedHtml(''), '');
  assert.equal(cleanupTranslatedHtml(null), '');
});

test('stripHtml removes tags but keeps text content', () => {
  assert.equal(stripHtml('<p>안녕 <b>하세요</b></p>'), '안녕 하세요');
});

test('stripHtml keeps alt text from img tags', () => {
  assert.equal(stripHtml('<img src="a.png" alt="고양이">'), '고양이');
});

test('stripHtml returns empty string for falsy input', () => {
  assert.equal(stripHtml(''), '');
  assert.equal(stripHtml(undefined), '');
});
