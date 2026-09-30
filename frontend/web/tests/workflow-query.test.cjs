const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

test('query ignores old responses and isolates account changes while preserving a draft during refresh', async () => {
  let cursor=0, effects=[]; const slots=[]; let userId='account-a'; const callbacks=[];
  const hooks={
    useState(initial){const i=cursor++; if(!(i in slots))slots[i]=initial;return[slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];},
    useRef(initial){const i=cursor++;return slots[i]||={current:initial};},
    useCallback(fn,deps){const i=cursor++; if(!slots[i])slots[i]=fn;return slots[i];},
    useEffect(fn,deps){const i=cursor++;const old=slots[i];if(!old||deps.some((d,n)=>d!==old.deps[n]))effects.push(()=>{old?.cleanup?.();slots[i]={deps,cleanup:fn()};});}
  };
  const filename=path.resolve(__dirname,'../src/features/workflow/useWorkflow.ts');const exports={};
  const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  vm.runInNewContext(code,{exports,AbortController,window:{addEventListener(){},removeEventListener(){},setInterval(){},clearInterval(){}},document:{visibilityState:'visible',addEventListener(){},removeEventListener(){}},require:name=>{
    if(name==='react')return hooks;
    if(name.endsWith('AuthContext'))return{useAuth:()=>({user:{userId}})};
    if(name.endsWith('use-signalr'))return{useSignalR:()=>({isConnected:true}),useSignalREvent(){}};
    if(name.endsWith('api.config'))return{};
    return{WorkflowApiError:class extends Error{}};
  }});
  const loader=(url,signal)=>new Promise(resolve=>callbacks.push({url,signal,resolve}));
  const render=path=>{cursor=0;effects=[];const result=exports.useWorkflowQuery(path,loader);effects.forEach(fn=>fn());return result;};
  render('/one'); render('/two'); assert.equal(callbacks[0].signal.aborted,true);
  callbacks[1].resolve({id:'second'});await Promise.resolve();
  callbacks[0].resolve({id:'old'});await Promise.resolve();
  let current=render('/two');assert.equal(current.data.id,'second');
  current.refresh();render('/two');current=render('/two');assert.equal(current.data.id,'second');assert.equal(current.loading,true);
  userId='account-b';current=render('/two');assert.equal(current.data,undefined);
  callbacks[2].resolve({id:'account-a-secret'});await Promise.resolve();
  current=render('/two');assert.equal(current.data,undefined);
  callbacks[3].resolve({id:'account-b'});await Promise.resolve();
  current=render('/two');assert.equal(current.data.id,'account-b');
});
