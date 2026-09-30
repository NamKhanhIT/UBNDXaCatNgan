const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function load(relative) {
  const filename = path.resolve(__dirname, '../src', relative);
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { exports, Date, Intl, require: name => name === '../lib/formatters' ? load('lib/formatters.ts') : require(name) }, { filename });
  return exports;
}

test('calendar date control displays Vietnam time even on a UTC device', () => {
  process.env.TZ = 'UTC';
  const { VnDateTimeInput } = load('components/VnDateTimeInput.tsx');
  const html = renderToStaticMarkup(React.createElement(VnDateTimeInput, { value: '2026-09-30T18:30:00Z', onChange() {} }));
  const selected = label => {
    const select = html.match(new RegExp(`<select[^>]*aria-label="${label}"[^>]*>([\\s\\S]*?)</select>`))[1];
    return select.match(/<option value="([^"]+)" selected="">/)[1];
  };
  assert.equal(selected('Ngày'), '1');
  assert.equal(selected('Tháng'), '10');
  assert.equal(selected('Giờ'), '1');
  assert.equal(selected('Phút'), '30');
});

test('administrative dates and explicit Vietnam input preserve the same instant', () => {
  const f = load('lib/formatters.ts');
  assert.equal(f.formatDateTimeShort('2026-09-30T18:30:00Z'), '01:30, 01-10-2026');
  assert.equal(f.vietnamDateTimeToUtc('01-10-2026', '01:30'), '2026-09-30T18:30:00.000Z');
  assert.equal(f.vietnamDateTimeToUtc('31-02-2026', '17:00'), null);
  assert.equal(f.formatDateTimeShort('2026-09-30T18:30:00'), 'Chưa xác định');
});
