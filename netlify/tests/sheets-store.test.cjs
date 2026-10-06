const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const G=require('../../Setwerk-Webapp-1.2.0-Projektdateien/dist/core.js'),C=require('../../Setwerk-Webapp-1.2.0-Projektdateien/dist/cloud-core.js');
const env={SETWERK_SHEETS_URL:'https://script.google.com/macros/s/test-deployment/exec',SETWERK_SHEETS_SECRET:'s'.repeat(64)};
const req=(body,origin='https://setwerk.test')=>new Request('https://setwerk.test/.netlify/functions/workout-store',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
async function setup(overrides={}){
 const {createHandler}=await import('../lib/sheets-store.mjs'),calls=[];
 const handler=createHandler({getUser:async()=>({id:'verified-owner'}),env,fetcher:async(url,options)=>{calls.push({url,options});return Response.json({status:200,revision:1});},...overrides});return{handler,calls};
}
test('server signs the verified user ID, ignores client owner, and never leaks secret',async()=>{
 const x=await setup(),response=await x.handler(req({revision:0,data:C.project(G.fresh()),userId:'victim'}));assert.equal(response.status,200);
 const envelope=JSON.parse(x.calls[0].options.body),payload=JSON.parse(envelope.payload);assert.equal(payload.userId,'verified-owner');assert.equal(payload.operation,'write');assert.equal(envelope.signature,crypto.createHmac('sha256',env.SETWERK_SHEETS_SECRET).update(envelope.payload).digest('base64url'));
 assert.match(response.headers.get('cache-control'),/no-store/);assert.doesNotMatch(await response.text(),/SETWERK|ssssss|verified-owner/);
});
test('unauthenticated and cross-origin requests cannot reach Sheets',async()=>{
 const anon=await setup({getUser:async()=>null});assert.equal((await anon.handler(new Request('https://setwerk.test/.netlify/functions/workout-store'))).status,401);assert.equal(anon.calls.length,0);
 const x=await setup();assert.equal((await x.handler(req({revision:0,data:C.project(G.fresh())},'https://attacker.test'))).status,403);assert.equal(x.calls.length,0);
});
test('server rejects drafts, invalid revisions, oversized payloads and malformed Google endpoints',async()=>{
 const x=await setup();assert.equal((await x.handler(req({revision:0,data:{...C.project(G.fresh()),active:{}}}))).status,400);assert.equal((await x.handler(req({revision:-1,data:C.project(G.fresh())}))).status,400);
 assert.equal((await x.handler(req({revision:0,data:C.project(G.fresh()),extra:'a'.repeat(1048576)}))).status,413);assert.equal(x.calls.length,0);
 const bad=await setup({env:{...env,SETWERK_SHEETS_URL:'https://attacker.test/exec'}});assert.equal((await bad.handler(new Request('https://setwerk.test/store'))).status,503);assert.equal(bad.calls.length,0);
});
test('server propagates stale revision conflicts and handles upstream failures',async()=>{
 const conflict=await setup({fetcher:async()=>Response.json({status:409})});assert.equal((await conflict.handler(req({revision:0,data:C.project(G.fresh())}))).status,409);
 const unavailable=await setup({fetcher:async()=>{throw Error('private-secret');}});const response=await unavailable.handler(new Request('https://setwerk.test/store'));assert.equal(response.status,502);assert.doesNotMatch(await response.text(),/private-secret/);
});
