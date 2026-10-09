/* Firebase Hosting supplies public project configuration; no private keys in the browser. */
const PROJECT_ID='setwerk-cb1e0';
let initialized=null;
const account=user=>user?{id:user.uid,email:user.email||'',name:user.displayName||''}:null;
async function resources(){
  if(!initialized)initialized=(async()=>{
    const response=await fetch('/__/firebase/init.json',{cache:'no-store'});
    if(!response.ok)throw Object.assign(Error('Firebase configuration unavailable'),{code:'setwerk/config'});
    const config=await response.json();
    if(config.projectId!==PROJECT_ID||!config.apiKey)throw Object.assign(Error('Firebase project is not configured'),{code:'setwerk/config'});
    const [appSDK,authSDK,storeSDK]=await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js')
    ]);
    const app=appSDK.initializeApp(config),auth=authSDK.getAuth(app);
    auth.useDeviceLanguage();
    await auth.authStateReady();
    const db=storeSDK.getFirestore(app);
    const store=window.SetwerkFirebaseStore.create({...storeSDK,auth,db});
    return{auth,authSDK,store,db,storeSDK};
  })().catch(error=>{initialized=null;throw error;});
  return initialized;
}
export async function getUser(){const {auth}=await resources();return account(auth.currentUser);}
export async function login(email,password){
  const {auth,authSDK}=await resources();
  return account((await authSDK.signInWithEmailAndPassword(auth,email,password)).user);
}
export async function signup(email,password,name){
  const {auth,authSDK}=await resources();
  const result=await authSDK.createUserWithEmailAndPassword(auth,email,password);
  // An optional display-name update must not turn a successful signup into an error.
  if(name)try{await authSDK.updateProfile(result.user,{displayName:name});}catch{}
  return account(result.user);
}
export async function logout(){const {auth,authSDK}=await resources();await authSDK.signOut(auth);}
function signedUser(auth){if(!auth.currentUser)throw Object.assign(Error('Please sign in again'),{code:'auth/requires-recent-login'});return auth.currentUser;}
export async function updateUserProfile(name){
  const {auth,authSDK}=await resources(),user=signedUser(auth);
  await authSDK.updateProfile(user,{displayName:name});return account(user);
}
async function confirmPassword(auth,authSDK,password){
  const user=signedUser(auth);
  await authSDK.reauthenticateWithCredential(user,authSDK.EmailAuthProvider.credential(user.email,password));
  if(auth.currentUser?.uid!==user.uid)throw Object.assign(Error('Please sign in again'),{code:'auth/requires-recent-login'});
  return user;
}
export async function changePassword(currentPassword,newPassword){
  const {auth,authSDK}=await resources();
  const user=await confirmPassword(auth,authSDK,currentPassword);await authSDK.updatePassword(user,newPassword);
}
export async function removeAccount(currentPassword){
  const {auth,authSDK,store}=await resources(),user=await confirmPassword(auth,authSDK,currentPassword);
  const resume=await window.SetwerkCloud.beginAccountDeletion(user.uid);
  let previous;
  try{
    previous=await store.erase(user.uid);
    try{await authSDK.deleteUser(user);}catch(error){
      if(previous)try{await store.restore(user.uid,previous.revision+1,previous.data);}catch{error.code='setwerk/delete-partial';}
      throw error;
    }
    window.SetwerkCloud.forgetAccount(user.uid);
  }finally{resume();}
}
export async function resetPassword(email){
  const {auth,authSDK}=await resources();
  try{await authSDK.sendPasswordResetEmail(auth,email);}catch(error){if(error.code!=='auth/user-not-found')throw error;}
}
export async function subscribeAuth(listener){
  const {auth,authSDK}=await resources();
  return authSDK.onAuthStateChanged(auth,user=>listener(account(user)));
}
export async function readStore(owner){
  try{const {store}=await resources();return await store.read(owner);}catch(error){throw window.SetwerkFirebaseStore.normalizeError(error);}
}
export async function writeStore(owner,revision,data){
  try{const {store}=await resources();return await store.write(owner,revision,data);}catch(error){throw window.SetwerkFirebaseStore.normalizeError(error);}
}
export async function readAppearance(owner){
  const {auth,db,storeSDK}=await resources();
  if(auth.currentUser?.uid!==owner)throw Object.assign(Error('Please sign in again'),{code:'auth/requires-recent-login'});
  const snapshot=await storeSDK.getDocFromServer(storeSDK.doc(db,'users',owner,'preferences','appearance'));
  return snapshot.exists()?snapshot.data().theme:'standard';
}
export async function writeAppearance(owner,theme){
  if(!['standard','cherry','orange','light-blue','black-white'].includes(theme))throw Error('Invalid color scheme');
  const {auth,db,storeSDK}=await resources();
  if(auth.currentUser?.uid!==owner)throw Object.assign(Error('Please sign in again'),{code:'auth/requires-recent-login'});
  await storeSDK.setDoc(storeSDK.doc(db,'users',owner,'preferences','appearance'),{theme,updatedAt:storeSDK.serverTimestamp()});
}
window.SetwerkFirebase={readStore,writeStore,readAppearance,writeAppearance};
