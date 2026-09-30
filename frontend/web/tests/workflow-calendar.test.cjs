const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

test('calendar loads every authorized task page and propagates cancellation', async () => {
  const filename = path.resolve(__dirname, '../src/features/calendar/calendarData.ts');
  const calls = []; const signal = new AbortController().signal; const exports = {};
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, require: name => name.endsWith('api.config') ? {
    apiFetch: async (url, options) => { calls.push({ url, options }); const page = Number(new URL(url, 'http://fixture').searchParams.get('page'));
      return { success: true, data: { items: Array.from({ length: page === 1 ? 100 : 23 }, (_, i) => ({ id: `${page}-${i}` })), totalCount: 123 } }; }
  } : { dataOf: response => response.data } }, { filename });
  const tasks = await exports.loadCalendarTasks('/api/v1/Tasks?scope=mine', signal);
  assert.equal(tasks.length, 123); assert.equal(calls.length, 2);
  assert.equal(calls[1].options.signal, signal);
  assert.match(calls[1].url, /page=2/);
  assert.match(calls[0].url, /scope=mine/);
});
