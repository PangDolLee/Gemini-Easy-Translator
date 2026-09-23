const test = require('node:test');
const assert = require('node:assert/strict');
const { cleanupTranslatedHtml, stripHtml, parseNumberedList } = require('../utils.js');

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

test('parseNumberedList maps translated lines back to original order', () => {
  const raw = '1. 안녕\n2. 세계\n3. 좋은 아침';
  assert.deepEqual(parseNumberedList(raw, 3), ['안녕', '세계', '좋은 아침']);
});

test('parseNumberedList leaves unparsed slots as null', () => {
  const raw = '1. 안녕\n설명 문구\n3. 좋은 아침';
  assert.deepEqual(parseNumberedList(raw, 3), ['안녕', null, '좋은 아침']);
});

test('parseNumberedList ignores out-of-range indices', () => {
  const raw = '1. 안녕\n5. 범위 밖';
  assert.deepEqual(parseNumberedList(raw, 2), ['안녕', null]);
});

test('parseNumberedList returns all-null array for empty input', () => {
  assert.deepEqual(parseNumberedList('', 2), [null, null]);
  assert.deepEqual(parseNumberedList(null, 2), [null, null]);
});
