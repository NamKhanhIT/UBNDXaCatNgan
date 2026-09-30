// Real HTTP -> controllers -> isolated PostgreSQL checks. Synthetic accounts only.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const base = 'http://127.0.0.1:5000';
let passed = 0;
function check(name, fn) { fn(); passed++; console.log(`PASS ${name}`); }
async function call(actor, path, values, method = values ? 'POST' : 'GET') {
  const response = await fetch(base + path, { method, signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/json', ...(actor ? { Authorization: `Bearer ${actor.token}` } : {}) },
    body: values ? JSON.stringify(values) : undefined });
  const data = await response.json(); return { status: response.status, ...data };
}
async function login(username) {
  const result = await call(null, '/api/v1/Auth/login', { username, password: 'WorkflowFixture2026!' });
  assert.equal(result.status, 200); return { id: result.data.userId, token: result.data.token };
}
async function detail(actor, id) { const result = await call(actor, `/api/v1/Tasks/${id}`); assert.equal(result.status, 200); return result.data; }
async function run() {
  const health = await fetch(base + '/health').then(r => r.json());
  assert.equal(health.fixture, true); assert.equal(health.database, 'workflow_acceptance_20260930');
  const leader = await login('fixture-leader'), deputy = await login('fixture-deputy'), officer = await login('fixture-officer'), outside = await login('fixture-outside');
  const people = await call(deputy, '/api/v1/WorkflowPermissions/people?purpose=assignee');
  check('deputy picker includes managed officer only', () => { assert.ok(people.data.some(p => p.id === officer.id)); assert.ok(!people.data.some(p => [leader.id, deputy.id, outside.id].includes(p.id))); });
  const payload = { requestId: randomUUID(), title: 'HTTP acceptance of deputy assignment', description: 'Synthetic validation', requirements: 'A verified result', assigneeId: officer.id, reviewerId: deputy.id, dueDate: new Date(Date.now()+86400000).toISOString(), assignerId: leader.id };
  const denied = await call(deputy, '/api/v1/Tasks', { ...payload, assigneeId: outside.id, requestId: randomUUID() });
  check('cross-department assignment denied', () => assert.equal(denied.status, 403));
  const invalid = await call(deputy, '/api/v1/Tasks', { ...payload, requirements: '', requestId: randomUUID() });
  check('missing result requirement rejected', () => assert.equal(invalid.status, 400));
  const pair = await Promise.all([call(deputy, '/api/v1/Tasks', payload), call(deputy, '/api/v1/Tasks', payload)]);
  check('parallel same request creates one task', () => { assert.equal(pair[0].status, 200); assert.equal(pair[1].status, 200); assert.equal(pair[0].data.id,pair[1].data.id); });
  const id = pair[0].data.id; let task = await detail(officer, id);
  check('body cannot impersonate assigner', () => assert.equal(task.assignerId, deputy.id));
  let result = await call(officer, `/api/v1/Tasks/${id}/status`, { requestId: randomUUID(), version: task.version, status: 'InProgress' }, 'PATCH'); assert.equal(result.status,200);
  task = await detail(officer,id);
  result = await call(officer, `/api/v1/Tasks/${id}/submissions`, { requestId: randomUUID(), version: task.version, submissionNote: 'Synthetic evidence submitted for deputy acceptance.' }); assert.equal(result.status,200);
  task = await detail(officer,id); const pending = task.submissions.find(s=>s.decision==='Pending');
  result = await call(officer, `/api/v1/Tasks/${id}/submissions/${pending.id}/review`, { requestId:randomUUID(),version:task.version,status:'Completed' });
  check('assignee cannot accept own submission', () => assert.equal(result.status,403));
  const reviews = await Promise.all([1,2].map(()=>call(deputy,`/api/v1/Tasks/${id}/submissions/${pending.id}/review`,{requestId:randomUUID(),version:task.version,status:'Completed',approvalNote:'Verified synthetic acceptance.'})));
  check('concurrent reviews permit one decision only',()=>assert.deepEqual(reviews.map(r=>r.status).sort(),[200,409]));
  const historicalList = await call(leader,'/api/v1/Tasks?scope=system&q='+encodeURIComponent('Tổng hợp báo cáo nghiệm thu trình văn bản'));
  const root = historicalList.data.items.find(t=>t.title==='Tổng hợp báo cáo nghiệm thu trình văn bản')?.id;
  assert.ok(root,'Complete the browser acceptance workflow first.');
  const outsideDetail = await call(outside,`/api/v1/Tasks/${root}`);
  check('outside task detail denied',()=>assert.equal(outsideDetail.status,404));
  assert.equal((await call(outside,`/api/v1/Tasks/${root}/system-score`)).status,403); passed++; console.log('PASS outside score denied');
  const historical = await detail(leader,root);
  check('both submission decisions preserved',()=>assert.deepEqual(historical.submissions.map(s=>s.decision).sort(),['Accepted','Returned']));
  check('review timestamp does not replace submission due evidence',()=>historical.submissions.forEach(s=>assert.equal(s.wasLate,Date.parse(s.submittedAt)>Date.parse(s.dueDateAtSubmission))));
  for(const submission of historical.submissions) for(const file of submission.files) {
    const response = await fetch(base+`/api/v1/Files/${file.id}/download`,{headers:{Authorization:`Bearer ${leader.token}`},signal:AbortSignal.timeout(15000)});
    assert.equal(response.status,200); const bytes=Buffer.from(await response.arrayBuffer()); assert.ok(bytes.includes(Buffer.from(file.name==='result-1.pdf'?'Submission round 1':'Submission round 2')));
    assert.ok([403,404].includes((await call(outside,`/api/v1/Files/${file.id}/download`)).status));
    passed++; console.log('PASS preserved submission file readable only within scope');
  }
  const list=await call(officer,'/api/v1/Tasks?scope=mine&tab=action_needed&page=1&pageSize=100');
  check('list total and action counter use same predicate',()=>{assert.equal(list.data.totalCount,list.data.items.length);assert.equal(list.data.totalCount,list.data.counts.action_needed);});
  console.log(`Verified ${passed} actual HTTP/PostgreSQL acceptance checks.`);
}
run().catch(error=>{console.error('Acceptance failed:',error.message);process.exitCode=1;});
