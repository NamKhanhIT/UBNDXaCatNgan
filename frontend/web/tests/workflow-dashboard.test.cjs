const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

test('dashboard uses canonical states and does not classify late review or cancelled work as overdue', () => {
  const filename = path.resolve(__dirname, '../src/lib/task-workflow.ts');
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { exports, Date }, { filename });
  const now = Date.parse('2026-09-30T03:00:00Z');
  const rows = ['Todo', 'InProgress', 'InReview', 'Completed', 'Cancelled'].map(status => ({ status, dueDate: '2026-09-29T10:00:00Z' }));
  assert.equal(rows.filter(exports.isTaskActionable).length, 2);
  assert.equal(rows.filter(exports.isTaskOpen).length, 3);
  assert.equal(rows.filter(task => exports.isTaskOverdue(task, now)).length, 2);
  const chart = exports.taskStatusDistribution({ completed: 7, active: 27, pendingReview: 2, overdue: 27, cancelled: 2 });
  assert.equal(Object.values(chart).reduce((sum, count) => sum + count, 0), 38);
  assert.equal(chart.active, 0);
  assert.equal(exports.isTaskOverdue({ status: 'Todo', dueDate: 'not-a-date' }, now), false);
  assert.equal(exports.isTaskOverdue({ status: 'Todo', dueDate: '2026-09-30T03:00:00Z' }, now), false);
});
