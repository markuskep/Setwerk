const test=require('node:test'),assert=require('node:assert/strict');
const Store=require('../assets/firebase-store.js'),G=require('../assets/core.js'),C=require('../assets/cloud-core.js');
function setup(){
 let stored=null,writes=[],reads=[],auth={currentUser:{uid:'alice'}};
 const snapshot=()=>({exists:()=>!!stored,data:()=>stored});
 const sdk={auth,db:{},doc:(_db,...segments)=>segments.join('/'),getDocFromServer:async ref=>{reads.push(ref);return snapshot();},serverTimestamp:()=> 'SERVER_TIME',runTransaction:async(_db,job)=>job({get:async()=>snapshot(),set:(ref,data)=>{writes.push({ref,data});stored=data;}})};
 return{store:Store.create(sdk),auth,writes,reads,sdk,getStored:()=>stored,setStored:value=>stored=value};
}
test('Firestore uses the authenticated user path and atomically increases the revision',async()=>{
 const x=setup(),data=C.project(G.fresh());assert.deepEqual(await x.store.read('alice'),{revision:0,data:null});
 assert.deepEqual(await x.store.write('alice',0,data),{revision:1,data:null});
 assert.equal(x.writes[0].ref,'users/alice/state/main');assert.equal(x.getStored().updatedAt,'SERVER_TIME');
 assert.deepEqual((await x.store.read('alice')).data,data);
 await x.store.write('alice',1,{...data,language:'en'});assert.equal(x.getStored().revision,2);
});
test('Firestore prevents a stale device from overwriting newer data',async()=>{
 const x=setup();x.setStored({revision:4,payload:JSON.stringify(C.project(G.fresh()))});
 await assert.rejects(x.store.write('alice',3,C.project(G.fresh())),e=>e.status===409);
 assert.equal(x.writes.length,0);assert.equal(x.getStored().revision,4);
});
test('Firestore rejects anonymous access and writing under another account',async()=>{
 const x=setup();await assert.rejects(x.store.read('bob'),e=>e.status===401);
 x.auth.currentUser=null;await assert.rejects(x.store.write('alice',0,C.project(G.fresh())),e=>e.status===401);
 assert.equal(x.reads.length,0);assert.equal(x.writes.length,0);
});
test('logging out during a transaction prevents its pending write',async()=>{
 const x=setup();x.sdk.runTransaction=async(_db,job)=>job({get:async()=>{x.auth.currentUser=null;return{exists:()=>false};},set:()=>{throw Error('Unexpected write');}});
 await assert.rejects(Store.create(x.sdk).write('alice',0,C.project(G.fresh())),e=>e.status===401);
});
test('large UTF-8 payloads fail locally instead of discarding local workout data',async()=>{
 const x=setup();await assert.rejects(x.store.write('alice',0,{note:'ä'.repeat(410000)}),e=>e.status===413);assert.equal(x.writes.length,0);
});
test('permission and configuration errors map to recoverable cloud states',()=>{
 assert.equal(Store.normalizeError({code:'permission-denied'}).status,403);
 assert.equal(Store.normalizeError({code:'not-found'}).status,503);
 assert.equal(Store.normalizeError({code:'resource-exhausted'}).status,429);
});
test('account deletion erases all payload data and prevents a stale client from restoring it',async()=>{
 const x=setup(),data=C.project(G.fresh());data.profile={name:'Private name',photo:''};
 await x.store.write('alice',0,data);const previous=await x.store.erase('alice');
 assert.deepEqual(previous,{revision:1,data});assert.equal(x.getStored().payload,'{"deleted":true}');assert.equal(x.getStored().revision,2);
 await assert.rejects(x.store.read('alice'),e=>e.status===410);await assert.rejects(x.store.write('alice',2,data),e=>e.status===410);
 await x.store.restore('alice',2,previous.data);assert.deepEqual((await x.store.read('alice')).data,data);assert.equal(x.getStored().revision,3);
 await assert.rejects(x.store.restore('alice',3,data),e=>e.status===409);
});
test('deletion never writes another account and handles an account with no cloud data',async()=>{
 const x=setup();await assert.rejects(x.store.erase('bob'),e=>e.status===401);assert.equal(await x.store.erase('alice'),null);assert.equal(x.writes.length,0);
});
