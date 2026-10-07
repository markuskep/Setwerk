/* Android adapter for the same Firebase account and snapshot API as the webapp. */
const native=window.SetwerkNative,listeners=new Set();
let current=window.SetwerkCloud?.user||null;
function emit(user){current=user;for(const listener of listeners)listener(user);return user;}
export async function getUser(){current=(await native.identity('user')).user||null;return current;}
export async function login(email,password){return emit(await native.identity('login',{email,password}));}
export async function signup(email,password,name){return emit(await native.identity('signup',{email,password,name}));}
export async function logout(){await native.identity('logout');emit(null);}
export async function subscribeAuth(listener){
  listeners.add(listener);
  listener(await getUser());
  return()=>listeners.delete(listener);
}
export async function resetPassword(email){await native.identity('reset',{email});}
export async function updateUserProfile(name){const user=await native.identity('profile',{name});return emit(user);}
export async function changePassword(currentPassword,newPassword){await native.identity('password',{currentPassword,newPassword});}
export async function removeAccount(currentPassword){
  const user=await native.identity('reauth',{password:currentPassword});
  if(user.id!==current?.id)throw Object.assign(Error('Please sign in again'),{code:'auth/requires-recent-login'});
  const resume=await window.SetwerkCloud.beginAccountDeletion(user.id);
  let previous;
  try{
    previous=(await native.call('cloud-erase',{owner:user.id})).previous;
    try{await native.identity('delete',{owner:user.id});}catch(error){
      if(previous)try{await native.call('cloud-restore',{owner:user.id,revision:previous.revision+1,data:previous.data});}catch{error.code='setwerk/delete-partial';}
      throw error;
    }
    window.SetwerkCloud.forgetAccount(user.id);emit(null);
  }finally{resume();}
}
export const readStore=owner=>native.call('cloud-read',{owner});
export const writeStore=(owner,revision,data)=>native.call('cloud-write',{owner,revision,data});
window.SetwerkFirebase={readStore,writeStore};
window.addEventListener('setwerk:resume',async()=>{try{emit(await getUser());}catch{}});
