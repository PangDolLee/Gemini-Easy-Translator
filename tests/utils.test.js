const test = require('node:test');
const assert = require('node:assert/strict');
const { cleanupTranslatedHtml, stripHtml } = require('../utils.js');

test('cleanupTranslatedHtml strips markdown code fences', () => {
  const input = '```html\n<p>안녕하세요</p>\n```';
  assert.equal(cleanupTranslatedHtml(input), '<p>안녕하세요</p>');
});

test('cleanupTranslatedHtml returns empty string for falsy input', () => {
  assert.equal(cleanupTranslatedHtml(''), '');
  assert.equal(cleanupTranslatedHtml(null), '');
});

test('cleanupTranslatedHtml strips style attributes but keeps other attributes and tags', () => {
  const input = '<p style="max-width:200px;margin:0 auto;text-align:center">본문 <a href="https://a.b" style="color:red" class="link">링크</a></p>';
  assert.equal(cleanupTranslatedHtml(input), '<p>본문 <a href="https://a.b" class="link">링크</a></p>');
});

test('cleanupTranslatedHtml strips style attributes using single quotes', () => {
  const input = "<div style='padding:0 40px'>본문</div>";
  assert.equal(cleanupTranslatedHtml(input), '<div>본문</div>');
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
