const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

function fixture(componentFile, exportName) {
  const values = []; let cursor = 0; const requests = [];
  const hooks = { ...React,
    useState(initial) { const index = cursor++; if (!(index in values)) values[index] = typeof initial === 'function' ? initial() : initial;
      return [values[index], value => { values[index] = typeof value === 'function' ? value(values[index]) : value; }]; },
    useRef(initial) { const index = cursor++; return values[index] ||= { current: initial }; },
    useCallback(fn) { return fn; }, useEffect() {} };
  const service = { queryString: () => '', WorkflowApiError: class extends Error {},
    workflowMutation: async (url, payload) => { requests.push({ url, payload }); return true; } };
  const query = url => ({ refresh() {}, data: url?.includes('/intake?') ? { items: [
    { id: 'account-a', fullName: 'A', canReceiveDocuments: false }, { id: 'account-b', fullName: 'B', canReceiveDocuments: false }
  ], totalCount: 2 } : [] });
  const load = (file, overrides = {}) => {
    const filename = path.resolve(__dirname, '../src/features/workflow', file); const exports = {};
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    vm.runInNewContext(code, { exports, crypto: require('node:crypto').webcrypto, window: {}, require: name => {
      if (overrides[name]) return overrides[name];
      if (name === 'react') return hooks;
      if (name === 'react/jsx-runtime') return require(name);
      if (name === './workflow.service') return service;
      if (name.endsWith('AuthContext')) return { useAuth: () => ({ user: { userId: 'officer' } }) };
      if (name.endsWith('use-signalr')) return {};
      if (name.endsWith('api.config')) return {};
      if (name.endsWith('formatters')) return { formatDateTimeShort: () => '' };
      if (name.endsWith('useDebounce')) return { useDebounce: value => value };
      if (name.endsWith('.css')) return { default: {} };
      if (name === './WorkflowDialog') return { WorkflowDialog() {} };
      if (name === './WorkflowFeedback') return { WorkflowError() {}, WorkflowLoading() {}, WorkflowPaging() {} };
      throw new Error(`Unexpected fixture import ${name}`);
    } }, { filename }); return exports;
  };
  const workflow = load('useWorkflow.ts');
  const component = load(componentFile, { './useWorkflow': { ...workflow, useWorkflowPermissions: () => ({ data: { canManageWorkflowPermissions: true }, refresh() {} }), useWorkflowQuery: query } })[exportName];
  return { requests, render(props = {}) { cursor = 0; return component(props); } };
}

function nodes(tree) {
  const items = []; const visit = element => {
    if (Array.isArray(element)) return element.forEach(visit);
    if (!element || typeof element !== 'object') return;
    items.push(element); visit(element.props?.children);
  }; visit(tree); return items;
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('granting two accounts for the same reason uses distinct logical requests', async () => {
  const f = fixture('WorkflowAdmin.tsx', 'WorkflowAdmin');
  for (let index = 0; index < 2; index++) {
    let tree = f.render();
    nodes(tree).filter(n => n.type === 'button' && n.props.children === 'Cấp quyền')[index].props.onClick();
    tree = f.render(); nodes(tree).find(n => n.type === 'textarea').props.onChange({ target: { value: 'Phân công tiếp nhận' } });
    tree = f.render(); nodes(tree).find(n => n.type === 'form').props.onSubmit({ preventDefault() {} }); await flush();
  }
  assert.equal(f.requests.length, 2);
  assert.notEqual(f.requests[0].payload.requestId, f.requests[1].payload.requestId);
});

test('marking an existing checklist item preserves a draft new item', async () => {
  const f = fixture('TaskChecklist.tsx', 'TaskChecklist');
  const props = { task: { id: 'task', version: 'version', status: 'InProgress', assigneeId: 'officer', subTasks: [{ id: 'item', title: 'Mục đã lưu', isCompleted: false }] }, onSaved() {}, onDirtyChange() {}, onBusyChange() {} };
  let tree = f.render(props);
  nodes(tree).find(n => n.type === 'input' && n.props.type !== 'checkbox').props.onChange({ target: { value: 'Nội dung đang nhập' } });
  tree = f.render(props); await nodes(tree).find(n => n.type === 'input' && n.props.type === 'checkbox').props.onChange({ target: { checked: true } }); await flush();
  tree = f.render(props);
  assert.equal(nodes(tree).find(n => n.type === 'input' && n.props.type !== 'checkbox').props.value, 'Nội dung đang nhập');
});
