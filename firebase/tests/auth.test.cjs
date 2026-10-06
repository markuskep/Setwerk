const test=require('node:test'),assert=require('node:assert/strict');
const {initializeApp,deleteApp}=require('firebase/app');
const {getAuth,connectAuthEmulator,createUserWithEmailAndPassword,signInWithEmailAndPassword,signOut,updateProfile}=require('firebase/auth');
const {getFirestore,connectFirestoreEmulator}=require('firebase/firestore');
const Store=require('../../Setwerk-Webapp-1.2.0-Projektdateien/dist/firebase-store.js');
const G=require('../../Setwerk-Webapp-1.2.0-Projektdateien/dist/core.js'),C=require('../../Setwerk-Webapp-1.2.0-Projektdateien/dist/cloud-core.js');
test('register, persist workout in Firestore, sign out and recover it on a second device',async()=>{
 const apps=[initializeApp({projectId:'demo-setwerk',apiKey:'demo-key'},'first-device'),initializeApp({projectId:'demo-setwerk',apiKey:'demo-key'},'second-device')];
 try{
  const devices=apps.map(app=>{const auth=getAuth(app);connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});const db=getFirestore(app);connectFirestoreEmulator(db,'127.0.0.1',8080);return{auth,store:Store.create({...require('firebase/firestore'),auth,db})};});
  const email='workout-'+Date.now()+'@example.test',password='test-password';
  const created=await createUserWithEmailAndPassword(devices[0].auth,email,password);
  await updateProfile(created.user,{displayName:'Markus'});const uid=created.user.uid;
  const data=C.project(G.fresh());data.sessions.push({id:'completed',name:'Training',category:'Kraft',date:'2026-10-06',duration:600,items:[]});
  await devices[0].store.write(uid,0,data);await signOut(devices[0].auth);
  await assert.rejects(devices[0].store.read(uid),e=>e.status===401);
  const signed=await signInWithEmailAndPassword(devices[1].auth,email,password);assert.equal(signed.user.uid,uid);
  const loaded=await devices[1].store.read(uid);assert.equal(loaded.revision,1);assert.deepEqual(loaded.data,data);
  await assert.rejects(signInWithEmailAndPassword(devices[1].auth,email,'incorrect-password'));
 }finally{await Promise.all(apps.map(deleteApp));}
});
