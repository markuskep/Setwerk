'use strict';
window.SetwerkStorage={
  getItem:key=>AndroidGym.storageGet(String(key)),
  setItem:(key,value)=>{if(!AndroidGym.storageSet(String(key),String(value)))throw Error('Local storage could not be written');},
  removeItem:key=>{if(!AndroidGym.storageRemove(String(key)))throw Error('Local storage could not be written');}
};
// Retain native guest storage while running the shared web storage logic.
Object.defineProperty(window,'localStorage',{value:window.SetwerkStorage});
window.SetwerkNative=(()=>{
  let serial=0;const pending=new Map();
  function call(operation,body={}){return new Promise((resolve,reject)=>{
    const id=String(++serial),timeout=setTimeout(()=>{pending.delete(id);reject(Object.assign(Error('Connection unavailable'),{code:'auth/network-request-failed'}));},120000);
    pending.set(id,{resolve,reject,timeout});
    try{AndroidGym.request(id,operation,JSON.stringify(body));}catch(error){clearTimeout(timeout);pending.delete(id);reject(error);}
  });}
  function receive(id,status,raw){
    const job=pending.get(id);if(!job)return;clearTimeout(job.timeout);pending.delete(id);
    let data;try{data=JSON.parse(raw);}catch{job.reject(Error('Invalid server response'));return;}
    if(status<200||status>=300){job.reject(Object.assign(Error(data.code||'Connection unavailable'),{status,code:data.code}));return;}
    job.resolve(data);
  }
  return{receive,call,identity:(operation,body)=>call('identity-'+operation,body)};
})();
// Export through Android's document picker instead of a WebView blob navigation.
const nativeAnchorClick=HTMLAnchorElement.prototype.click;
HTMLAnchorElement.prototype.click=function(){
  if(this.download&&this.href.startsWith('blob:')){
    const name=this.download;fetch(this.href).then(r=>r.blob()).then(blob=>{const reader=new FileReader();reader.onload=()=>AndroidGym.saveFile(name,String(reader.result).split(',')[1]);reader.readAsDataURL(blob);}).catch(()=>window.toast?.('Datei konnte nicht gespeichert werden.'));return;
  }
  return nativeAnchorClick.call(this);
};
window.addEventListener('setwerk:resume',()=>{if(window.SetwerkCloud?.user)window.SetwerkCloud.sync();});
