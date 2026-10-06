const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {initializeTestEnvironment,assertFails,assertSucceeds}=require('@firebase/rules-unit-testing');
const {doc,setDoc,getDoc,deleteDoc,collection,getDocs,serverTimestamp}=require('firebase/firestore');
let env;
test.before(async()=>{env=await initializeTestEnvironment({projectId:'demo-setwerk',firestore:{host:'127.0.0.1',port:8080,rules:fs.readFileSync('firestore.rules','utf8')}});});
test.after(async()=>{await env?.cleanup();});
test.beforeEach(async()=>{await env.clearFirestore();});
const state=revision=>({revision,payload:'{"version":1}',updatedAt:serverTimestamp()});
const ref=uid=>doc(env.authenticatedContext(uid).firestore(),'users',uid,'state','main');
test('owner can create, read and update their snapshot',async()=>{
 const own=ref('alice');await assertSucceeds(setDoc(own,state(1)));await assertSucceeds(getDoc(own));await assertSucceeds(setDoc(own,state(2)));
});
test('another account and anonymous users cannot read or write private snapshots',async()=>{
 await setDoc(ref('alice'),state(1));
 const bob=env.authenticatedContext('bob').firestore(),guest=env.unauthenticatedContext().firestore();
 for(const db of [bob,guest]){
  await assertFails(getDoc(doc(db,'users','alice','state','main')));
  await assertFails(setDoc(doc(db,'users','alice','state','main'),state(2)));
 }
});
test('stale revisions, extra fields, client timestamps and oversized data are denied',async()=>{
 const own=ref('alice');await setDoc(own,state(1));
 await assertFails(setDoc(own,state(1)));
 await assertFails(setDoc(own,{...state(2),password:'private'}));
 await assertFails(setDoc(own,{...state(2),updatedAt:new Date(0)}));
 await assertFails(setDoc(own,{...state(2),payload:'x'.repeat(800001)}));
});
test('collection listing, arbitrary documents and deleting state are denied',async()=>{
 await setDoc(ref('alice'),state(1));const db=env.authenticatedContext('alice').firestore();
 await assertFails(getDocs(collection(db,'users')));
 await assertFails(setDoc(doc(db,'users','alice','state','other'),state(1)));
 await assertFails(deleteDoc(ref('alice')));
});
