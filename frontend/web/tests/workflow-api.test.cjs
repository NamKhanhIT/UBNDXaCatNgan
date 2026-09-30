const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function api(fetch) {
  const store = new Map([['ubnd_access_token', 'expired-fixture'], ['ubnd_refresh_token', 'refresh-fixture'], ['ubnd_cached_user', JSON.stringify({ userId: 'fixture-user' })]]);
  const storage = { getItem: key => store.get(key) || null, setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key) };
  const exports = {};
  const scope = { exports, fetch, console, URL, localStorage: storage, sessionStorage: storage,
    window: { location: { hostname: 'localhost', origin: 'http://localhost:3000' }, dispatchEvent() {} },
    process: { env: {} } };
  const filename = path.join(__dirname, '../src/services/api.config.ts');
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, scope, { filename });
  return exports;
}

test('upload retry uses the refreshed session and preserves the exact submitted form', async () => {
  const calls = [];
  const fixture = api(async (url, options) => {
    calls.push({ url, authorization: options.headers.Authorization, body: options.body });
    if (url.endsWith('/refresh')) return new Response(JSON.stringify({ token: 'renewed-fixture', refreshToken: 'next-fixture' }), { status: 200 });
    return options.headers.Authorization === 'Bearer renewed-fixture'
      ? new Response(JSON.stringify({ success: true, data: 'saved-file' }), { status: 200 })
      : new Response('{}', { status: 401 });
  });
  const form = new FormData(); form.set('requestId', 'fixture-request');
  const result = await fixture.apiUpload('/upload', form);
  assert.equal(result.success, true);
  assert.equal(result.data, 'saved-file');
  assert.equal(calls[0].body, form);
  assert.equal(calls[2].body, form);
  assert.equal(calls.length, 3);
});

test('upload preserves HTTP permission status so forms can distinguish permission and network errors', async () => {
  const result = await api(async () => new Response(JSON.stringify({ error: 'Denied' }), { status: 403 })).apiUpload('/upload', new FormData());
  assert.equal(result.success, false);
  assert.equal(result.status, 403);
});

test('network failure has an explicit unknown outcome status for safe retry', async () => {
  const result = await api(async () => { throw new TypeError('Synthetic disconnected network'); }).apiUpload('/upload', new FormData());
  assert.equal(result.success, false);
  assert.equal(result.status, 0);
});

test('parallel queries and file requests share one session refresh', async () => {
  let release; const barrier = new Promise(resolve => { release = resolve; }); let refreshes = 0;
  const fixture = api(async (url, options) => {
    if (url.endsWith('/refresh')) { refreshes++; await barrier; return new Response(JSON.stringify({ token: 'renewed-fixture', refreshToken: 'next-fixture' })); }
    return options.headers.Authorization === 'Bearer renewed-fixture'
      ? new Response(JSON.stringify({ success: true, data: 'saved' })) : new Response('{}', { status: 401 });
  });
  const pending = [fixture.apiFetch('/one'), fixture.apiFetch('/two'), fixture.apiUpload('/file', new FormData()), fixture.apiFileBlob('/preview')];
  await Promise.resolve(); await Promise.resolve(); release();
  assert.ok((await Promise.all(pending)).every(result => result.success));
  assert.equal(refreshes, 1);
});

test('a late failed refresh cannot clear a newly signed in session', async () => {
  let release; const barrier = new Promise(resolve => { release = resolve; });
  const fixture = api(async url => { if(url.endsWith('/refresh')) await barrier; return new Response('{}', { status: 401 }); });
  const pending = fixture.apiFetch('/old-session');
  await Promise.resolve(); await Promise.resolve();
  fixture.clearSessionStorage(); fixture.storeToken('other-access-fixture'); fixture.storeRefreshToken('other-refresh-fixture');
  release(); await pending;
  assert.equal(fixture.getStoredToken(), 'other-access-fixture');
});

test('refresh network loss preserves the session and reports an unknown network outcome', async () => {
  const fixture = api(async url => { if(url.endsWith('/refresh')) throw new TypeError('Fixture network loss'); return new Response('{}', { status: 401 }); });
  const result = await fixture.apiFetch('/query');
  assert.equal(result.status, 0);
  assert.equal(fixture.getStoredToken(), 'expired-fixture');
});

test('a delayed old 401 retries with the refreshed session without rotating it again', async () => {
  let release; const barrier = new Promise(resolve => { release = resolve; }); let refreshes = 0;
  const fixture = api(async (url, options) => {
    if(url.endsWith('/refresh')) { refreshes++; return new Response(JSON.stringify({ token:'renewed-fixture',refreshToken:'next-fixture' })); }
    if(options.headers.Authorization === 'Bearer renewed-fixture') return new Response(JSON.stringify({success:true}));
    if(url.endsWith('/slow')) await barrier;
    return new Response('{}', {status:401});
  });
  const slow = fixture.apiFetch('/slow');
  assert.equal((await fixture.apiFetch('/fast')).success,true);
  release(); assert.equal((await slow).success,true);
  assert.equal(refreshes,1);
});
