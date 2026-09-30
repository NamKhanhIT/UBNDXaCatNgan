const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

test('discard confirmation focuses Continue and restores the draft field', () => {
  let cursor = 0; const slots = []; let effects = [];
  const document = { activeElement: null };
  const input = { focus() { document.activeElement = input; }, isConnected: true };
  const continueButton = { focus() { document.activeElement = continueButton; }, isConnected: true };
  const dialog = { showModal() {}, close() {}, contains: () => true };
  const hooks = { useId: () => 'dialog-title',
    useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial }; },
    useState(initial) { const i = cursor++; if(!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = value; }]; },
    useEffect(fn, deps) { const i = cursor++; const previous = slots[i]; if(!previous || deps.some((value,n)=>value!==previous[n])) effects.push(fn); slots[i] = deps; }
  };
  const filename = path.resolve(__dirname,'../src/features/workflow/WorkflowDialog.tsx'); const exports = {};
  const code = ts.transpileModule(fs.readFileSync(filename,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(code,{exports,document,window:{addEventListener(){},removeEventListener(){}},require:name=>name==='react'?hooks:name==='react/jsx-runtime'?require(name):{default:{}}});
  const all = tree => {const items=[]; const visit=n=>{if(Array.isArray(n))return n.forEach(visit); if(!n||typeof n!=='object')return;items.push(n);visit(n.props?.children);};visit(tree);return items;};
  const render = () => {cursor=0;effects=[]; const tree=exports.WorkflowDialog({title:'Fixture',dirty:true,onClose(){},children:React.createElement('input')}); tree.ref.current=dialog;
    for(const node of all(tree)) if(node.type==='button'&&node.props.children==='Tiếp tục chỉnh sửa'&&node.ref) node.ref.current=continueButton;
    effects.forEach(fn=>fn()); return tree;};
  let tree=render(); input.focus(); tree.props.onCancel({preventDefault(){}}); tree=render();
  assert.equal(document.activeElement,continueButton);
  all(tree).find(n=>n.type==='button'&&n.props.children==='Tiếp tục chỉnh sửa').props.onClick(); render();
  assert.equal(document.activeElement,input);
});
