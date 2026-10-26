const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '..');
async function load(file, overrides = {}, globals = {}) {
  const context = vm.createContext({ console, process: { env: { NODE_ENV: 'test' } }, setTimeout, clearTimeout, AbortController, URL, URLSearchParams, fetch: () => { throw Error('Unexpected network access'); }, ...globals });
  const cache = new Map();
  function mod(f) {
    if (cache.has(f)) return cache.get(f);
    const values = overrides[f] || (f.startsWith('node:') ? { default: require(f) } : f.endsWith('.json') ? { default: JSON.parse(fs.readFileSync(f, 'utf8')) } : null);
    const m = values ? new vm.SyntheticModule(Object.keys(values), function () { Object.entries(values).forEach(([k,v]) => this.setExport(k,v)); }, { context, identifier: f }) : new vm.SourceTextModule(fs.readFileSync(f, 'utf8'), { context, identifier: f });
    cache.set(f,m); return m;
  }
  const entry = mod(path.join(root,file));
  await entry.link((s,p) => mod(overrides[s] || s.startsWith('node:') ? s : s === 'crypto' ? 'node:crypto' : path.resolve(s.startsWith('@/') ? root : path.dirname(p.identifier), (s.startsWith('@/') ? s.slice(2) : s) + (path.extname(s) ? '' : '.js'))));
  await entry.evaluate(); return entry.namespace;
}
const full = (f) => path.join(root, 'lib', f + '.js');
const response = (status, value = {}, retryAfter = null) => ({ status, ok: status >= 200 && status < 300, headers: { get: () => retryAfter }, json: async () => value });
const flush = () => new Promise(r => setImmediate(r));

test('Google reads recover from network failures, 429 and 503 with jitter; logs contain no URL or cell data', async () => {
  const m = await load('lib/sheetsRead.js');
  let n=0, clock=0; const waits=[], logs=[];
  const value = await m.bacaJsonGoogle('https://test.invalid/private?key=SECRET', {}, { fetcher: async () => { n++; if(n===1) throw TypeError('fetch failed SECRET'); if(n===2) return response(429, {}, '3'); if(n===3) return response(503); return response(200, { cells: ['PRIVATE'] }); }, now:()=>clock, random:()=>0.5, sleep:async ms=>{waits.push(ms);clock+=ms;}, log:e=>logs.push(e) });
  assert.equal(value.cells[0], 'PRIVATE'); assert.equal(n,4);
  assert.deepEqual(waits,[1500,3000,4500]);
  assert.equal(logs.at(-1).hasil,'pulih'); assert.equal(logs.at(-1).durasiMs,9000);
  assert.doesNotMatch(JSON.stringify(logs), /SECRET|PRIVATE|test.invalid/);
});
test('permanent permission errors are not retried and long Retry-After respects the total budget', async () => {
  const m = await load('lib/sheetsRead.js'); let n=0;
  for(const status of [400,401,403,404,429]) {
    n=0;
    await assert.rejects(m.bacaJsonGoogle('test', {}, { fetcher:async()=>{n++;return response(status, {}, '60');}, budgetMs:10000, log:()=>{} }), e=>e.status===status);
    assert.equal(n,1);
  }
});
test('timeout also bounds a stalled response body and aborts the request', async () => {
  const m=await load('lib/sheetsRead.js'); let signal;
  await assert.rejects(m.bacaJsonGoogle('test', {}, { fetcher:async(_,o)=>{signal=o.signal;return {...response(200),json:()=>new Promise(()=>{})};},timeoutMs:5,attempts:1,log:()=>{} }), e=>e.code==='TIMEOUT');
  assert.equal(signal.aborted,true);
});
test('batch readers merge overlapping ranges, preserve caller order and recover after failed requests', async () => {
  const m=await load('lib/sheetsRead.js'); let calls=0,fail=false;
  const read=m.buatBatchPembaca(async ranges=>{calls++;if(fail)throw Error('unavailable');return ranges.map(r=>[[r]]);},1);
  const a=read('sheet',['A','B']), b=read('sheet',['B','C']), c=read('sheet',['A','B']);
  assert.equal(a,c); assert.equal((await a)[1][0][0],'B');assert.equal((await b)[1][0][0],'C');assert.equal(calls,1);
  fail=true;await assert.rejects(read('sheet',['A']),/unavailable/);fail=false;
  assert.equal((await read('sheet',['A']))[0][0][0],'A');assert.equal(calls,3);
});
test('client coalesces reads and always performs a new read after an in-flight pre-save request', async () => {
  const m=await load('lib/sinkronisasi.js'), run=m.buatAntrianSinkron(); let done,n=0;
  const old=run('october',()=>{n++;return new Promise(r=>done=r);},true);
  const same=run('october',()=>{throw Error('duplicate');}); assert.equal(old,same);
  const fresh=run('october',()=>{n++;return 'new after save';},true);
  assert.equal(run('october',()=>{},true),fresh);assert.equal(run('october',()=>{}),fresh);
  await flush();assert.equal(n,1);done('before save');assert.equal(await old,'before save');assert.equal(await fresh,'new after save');assert.equal(n,2);
  await assert.rejects(run('october',()=>Promise.reject(Error('offline'))),/offline/);
  assert.equal(await run('october',()=>42),42);
});
test('browser read rejects partial errors and HTML responses instead of accepting empty data', async () => {
  let r=response(503,{error:'Quota busy'});
  const m=await load('lib/sinkronisasi.js',{}, {fetch:async()=>r});
  await assert.rejects(m.bacaApi('/api'),/Quota busy/);
  r=response(200,{source:'error',rows:[],error:'Sheet unavailable'});await assert.rejects(m.bacaApi('/api'),/Sheet unavailable/);
  r={...response(200),json:async()=>{throw Error('HTML');}};await assert.rejects(m.bacaApi('/api'),/HTTP 200/);
  r=response(401,{});await assert.rejects(m.bacaApi('/api'),e=>e.expired===true);
  r=response(200,{rows:[1]});assert.equal((await m.bacaApi('/api')).rows[0],1);
});
test('scheduler merges focus/visibility, pauses hidden or offline, backs off and cleans up', async () => {
  let now=10000,id=0,calls=0,ok=true;const timers=new Map();
  const set=(fn,ms)=>{timers.set(++id,{fn,at:now+ms});return id;};const clear=id=>timers.delete(id);
  const advance=async ms=>{const end=now+ms;for(;;){const due=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;now=due[1].at;timers.delete(due[0]);due[1].fn();await flush();}now=end;};
  const doc=new EventTarget();doc.visibilityState='visible';const win=new EventTarget();win.navigator={onLine:true};
  const m=await load('lib/sinkronisasi.js',{}, {setTimeout:set,clearTimeout:clear});
  const stop=m.jadwalkanSinkron(async()=>{calls++;return ok;},{doc,win,interval:10000,debounce:10,now:()=>now,random:()=>0});
  win.dispatchEvent(new Event('focus'));doc.dispatchEvent(new Event('visibilitychange'));await advance(10);assert.equal(calls,1);
  doc.visibilityState='hidden';doc.dispatchEvent(new Event('visibilitychange'));await advance(50000);assert.equal(calls,1);
  doc.visibilityState='visible';win.navigator.onLine=false;win.dispatchEvent(new Event('offline'));await advance(50000);assert.equal(calls,1);
  win.navigator.onLine=true;win.dispatchEvent(new Event('online'));await advance(10);assert.equal(calls,2);
  ok=false;await advance(10000);assert.equal(calls,3);await advance(10000);assert.equal(calls,3);await advance(10000);assert.equal(calls,4);
  stop();await advance(500000);assert.equal(calls,4);assert.equal(timers.size,0);
});
test('display cache separates resource/month, preserves timestamps and force refresh bypasses old cache', async () => {
  const saved=new Map();let clears=0;
  const m=await load('lib/cacheTampilan.js',{'next/cache':{unstable_cache:(fn,key)=>async()=>{const k=JSON.stringify(key);if(!saved.has(k))saved.set(k,await fn());return saved.get(k);},revalidateTag:()=>{saved.clear();clears++;}}});
  let n=0;const read=async()=>({value:++n});
  const a=await m.bacaTampilan('board:October',read), b=await m.bacaTampilan('board:October',read);
  assert.equal(a.value,b.value);assert.equal(a.at,b.at);
  assert.equal((await m.bacaTampilan('board:November',read)).value,2);
  assert.equal((await m.bacaTampilan('board:October',read,{segar:true})).value,3);assert.equal(clears,1);
  await assert.rejects(m.bacaTampilan('broken',async()=>({source:'error',rows:[],error:'failed'})),/failed/);
  assert.equal((await m.bacaTampilan('broken',async()=>({rows:[7]}))).rows[0],7);
});
test('live board failures throw instead of becoming sample data; a genuinely empty month remains live', async () => {
  let fail=true, reads=0;
  const gauth={ SHEET_IDS:{master:'fixture'},authParams:async()=>({write:true}),tabTitles:async()=>['Oktober_'],batchRead:async(_,ranges)=>{if(ranges[0].includes('B9:K9'))return [[['ID project','','Subtes','','','Kebutuhan','Sisa','','','ID project']]];reads++;if(fail)throw Object.assign(Error('quota'),{status:429});return ranges.map(()=>[]);},batchWrite:async()=>{},batchClear:async()=>{} };
  const m=await load('lib/juli.js',{[full('gauth')]:gauth,[full('demo')]:{MODE_DEMO:false}});
  await assert.rejects(m.getBoard('Oktober_'),e=>e.status===429);assert.equal(reads,1,'no second read storm for a quota error');
  fail=false;const data=await m.getBoard('Oktober_');assert.equal(data.source,'live');assert.equal(data.tab,'Oktober_');assert.equal(data.projects.length,0);
  const sample=await load('lib/juli.js',{[full('gauth')]:{...gauth,authParams:async()=>null},[full('demo')]:{MODE_DEMO:false}});
  assert.equal((await sample.getBoard()).source,'sample','sample only when credentials are absent');
});

test('Google metadata reads share one in-flight request and a failed flight does not poison later reads', async () => {
  let calls=0,fail=true;
  const m=await load('lib/gauth.js', {[full('cacheTampilan')]:{hapusCacheTampilan:()=>{}}}, {fetch:async()=>{calls++;return fail?response(403):response(200,{sheets:[{properties:{title:'Oktober_',sheetId:1}}]});},console:{warn:()=>{}},Buffer});
  const ap={headers:{},key:''};
  const first=await Promise.allSettled([m.sheetMeta('test',ap),m.tabTitles('test',ap)]);
  assert.equal(first.every(r=>r.status==='rejected'),true);assert.equal(calls,1);
  fail=false;assert.equal((await m.tabTitles('test',ap))[0],'Oktober_');assert.equal(calls,2);
});

test('ambiguous append and structural writes are never retried; they invalidate display caches', async () => {
  let writes=0,invalidations=0,tokens=0;
  const crypto=require('node:crypto');
  const m=await load('lib/gauth.js', {
    'node:crypto':{default:{...crypto,createSign:()=>({update(){},end(){},sign:()=>Buffer.from('test-signature')})}},
    [full('cacheTampilan')]:{hapusCacheTampilan:()=>invalidations++},
  }, {Buffer,process:{env:{NODE_ENV:'test',GOOGLE_SERVICE_ACCOUNT_JSON:JSON.stringify({client_email:'fixture@example.invalid',private_key:'TEST'})}},fetch:async url=>{if(url.includes('oauth2')){tokens++;return response(200,{access_token:'fixture-token',expires_in:3600});}writes++;throw TypeError('network lost after possible commit');},console:{warn:()=>{}}});
  await assert.rejects(m.appendRows('test','A1',[['test']]),/network lost/);
  assert.equal(writes,1);assert.equal(invalidations,2);
  await assert.rejects(m.structuralUpdate('test',[{appendCells:{}}]),/network lost/);
  assert.equal(writes,2);assert.equal(tokens,1);assert.equal(invalidations,4);
});

test('permission probe does not misclassify an outage as Viewer access and caches per spreadsheet', async () => {
  let status=503,calls=0;
  const crypto=require('node:crypto');
  const m=await load('lib/gauth.js', {
    'node:crypto':{default:{...crypto,createSign:()=>({update(){},end(){},sign:()=>Buffer.from('test-signature')})}},
    [full('cacheTampilan')]:{hapusCacheTampilan:()=>{}},
  }, {Buffer,process:{env:{NODE_ENV:'test',GOOGLE_SERVICE_ACCOUNT_JSON:JSON.stringify({client_email:'fixture@example.invalid',private_key:'TEST'})}},fetch:async url=>{if(url.includes('oauth2'))return response(200,{access_token:'fixture-token',expires_in:3600});calls++;return response(status);},console:{warn:()=>{}}});
  await assert.rejects(m.probeWriteAccess('A'),e=>e.status===503);
  status=400;assert.equal(await m.probeWriteAccess('A'),true);assert.equal(calls,2);
  assert.equal(await m.probeWriteAccess('A'),true);assert.equal(calls,2);
  status=403;assert.equal(await m.probeWriteAccess('B'),false);assert.equal(calls,3,'another spreadsheet has independent permissions');
});
